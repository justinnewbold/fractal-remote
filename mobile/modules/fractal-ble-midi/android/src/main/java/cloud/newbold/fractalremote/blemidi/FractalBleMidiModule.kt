package cloud.newbold.fractalremote.blemidi

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.pm.PackageManager
import android.media.midi.MidiDevice
import android.media.midi.MidiDeviceInfo
import android.media.midi.MidiInputPort
import android.media.midi.MidiManager
import android.media.midi.MidiOutputPort
import android.media.midi.MidiReceiver
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import android.util.Log
import expo.modules.interfaces.permissions.PermissionsResponseListener
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.Closeable
import java.util.UUID

/*
 * THE PHONE'S END OF A BLUETOOTH MIDI ADAPTER, ON ANDROID.
 *
 * The same calls and events as the iPhone's (ios/FractalBleMidiModule.swift),
 * so the JavaScript does not care which phone it is on. Only the finding
 * differs: iOS pairs through Apple's own screen, while Android scans for
 * anything advertising the Bluetooth MIDI service and opens it directly.
 *
 *   supported()          — the phone has both MIDI and Bluetooth LE.
 *   requestPermissions() — Android 12 and newer: "Nearby devices" (scan and
 *                          connect). Older: location, which Android then
 *                          required for any Bluetooth scan. True if granted.
 *   pair()               — refused (E_UNSUPPORTED): there is no pairing step.
 *   scan(seconds)        — looks for adapters for that long, then stops by
 *                          itself; what it finds goes out through onDevices.
 *                          False when Bluetooth is off, so the page can say so.
 *   devices()            — what the last scan found: id is the adapter's
 *                          Bluetooth address, with its name and signal (rssi).
 *   connect(id), disconnect()
 *   send(bytes)          — straight to the adapter, which passes them on to
 *                          the unit's MIDI In.
 *   onBytes { bytes }    — each piece that comes in, exactly as it came.
 *   onState { state, id, name, reason? }
 *                        — 'connected' after connect; 'disconnected' when
 *                          Android says our adapter has gone.
 *
 * NOTHING HAPPENS UNTIL IT IS ASKED FOR. No scan, no permission prompt and
 * no Bluetooth or MIDI service is touched until the JavaScript calls one of
 * the above, which it only does from the Bluetooth page.
 *
 * NO REASSEMBLY HERE. Android's own documentation says incoming data "can
 * contain multiple messages or partial messages", with real-time bytes in
 * between. The JavaScript joiner (createJoiner) sorts all that out, the same
 * code on both phones, tested in Node.
 *
 * Every Bluetooth call below is made only after the JavaScript has asked for
 * the permissions; one that is refused anyway throws SecurityException, which
 * is caught and becomes E_PERMISSION. That is why lint's MissingPermission is
 * switched off for the class.
 */
@SuppressLint("MissingPermission")
class FractalBleMidiModule : Module() {
  /* One open adapter: the device and both its ports, kept together so they
     are always closed together. The device has to stay referenced for as long
     as it is wanted: Android closes a MidiDevice that is garbage collected. */
  private class Link(
    val id: String,
    val name: String,
    val device: MidiDevice,
    val toUnit: MidiInputPort,
    val fromUnit: MidiOutputPort,
    val listener: MidiReceiver
  )

  private val main = Handler(Looper.getMainLooper())

  /* Touched from the JavaScript thread, the main thread and Android's MIDI
     and Bluetooth threads, so only read or written while holding `lock`. */
  private val lock = Any()
  private var link: Link? = null
  private var attempt = 0
  private var scanner: BluetoothLeScanner? = null
  private var scanning: ScanCallback? = null
  private var watching: MidiManager.DeviceCallback? = null
  private val found = LinkedHashMap<String, Map<String, Any?>>()

  private val scanEnds = Runnable { stopScanning() }

  private val context: Context?
    get() = appContext.reactContext

  private val bluetooth: BluetoothAdapter?
    get() = (context?.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

  private val midi: MidiManager?
    get() = context?.getSystemService(Context.MIDI_SERVICE) as? MidiManager

  override fun definition() = ModuleDefinition {
    Name("FractalBleMidi")

    Events("onBytes", "onDevices", "onState")

    OnDestroy {
      stopScanning()
      close()
      unwatch()
    }

    Function("supported") {
      supported()
    }

    AsyncFunction("requestPermissions") { promise: Promise ->
      requestPermissions(promise)
    }

    AsyncFunction("pair") { promise: Promise ->
      promise.reject("E_UNSUPPORTED", "Android finds Bluetooth MIDI adapters by scanning; there is no pairing screen.", null)
    }

    /* On the main thread, like the scan and open callbacks, so a scan or a
       connection starting and its first answer never race each other. */
    AsyncFunction("scan") { seconds: Int, promise: Promise ->
      scan(seconds, promise)
    }.runOnQueue(Queues.MAIN)

    Function("stopScan") {
      stopScanning()
    }

    Function("devices") {
      synchronized(lock) { found.values.toList() }
    }

    AsyncFunction("connect") { id: String, promise: Promise ->
      connect(id, promise)
    }.runOnQueue(Queues.MAIN)

    Function("disconnect") {
      close()
    }

    Function("send") { bytes: List<Int> ->
      send(bytes)
    }
  }

  private fun supported(): Boolean {
    val packages = context?.packageManager ?: return false
    return packages.hasSystemFeature(PackageManager.FEATURE_MIDI) &&
      packages.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE)
  }

  // Permissions

  /* The same permissions manager expo-audio asks through, but answered as a
     plain yes or no, which is what the iPhone side gives too. */
  private fun requestPermissions(promise: Promise) {
    val wanted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
    } else {
      arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
    }
    val permissions = appContext.permissions
    if (permissions == null) {
      promise.reject("E_PERMISSION", "The permissions service is not available.", null)
      return
    }
    if (permissions.hasGrantedPermissions(*wanted)) {
      promise.resolve(true)
      return
    }
    try {
      permissions.askForPermissions(
        PermissionsResponseListener { result ->
          promise.resolve(wanted.all { result[it]?.status == PermissionsStatus.GRANTED })
        },
        *wanted
      )
    } catch (e: RuntimeException) {
      promise.reject("E_PERMISSION", e.message, e)
    }
  }

  // Scanning

  /* Main thread. Only adapters advertising the Bluetooth MIDI service are
     reported, so a scan in a room full of headphones still finds just the
     adapter. Android 11 and older also need Location switched on in the
     phone's settings, or the scan quietly finds nothing. */
  private fun scan(seconds: Int, promise: Promise) {
    val adapter = bluetooth
    if (!supported() || adapter == null || !adapter.isEnabled) {
      promise.resolve(false)
      return
    }
    val le = adapter.bluetoothLeScanner
    if (le == null) {
      promise.resolve(false)
      return
    }
    stopScanning()
    synchronized(lock) {
      found.clear()
      /* A connected adapter stops advertising, so it would vanish from the
         list it was chosen from; it is kept in. */
      link?.let { found[it.id] = mapOf("id" to it.id, "name" to it.name) }
    }
    val callback = object : ScanCallback() {
      override fun onScanResult(callbackType: Int, result: ScanResult) {
        heard(this, result)
      }

      override fun onScanFailed(errorCode: Int) {
        Log.w(TAG, "Bluetooth scan failed: $errorCode")
        stopScanning()
      }
    }
    val filter = ScanFilter.Builder().setServiceUuid(ParcelUuid(MIDI_SERVICE)).build()
    val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
    try {
      le.startScan(listOf(filter), settings, callback)
    } catch (e: SecurityException) {
      promise.reject("E_PERMISSION", "Bluetooth permission is needed to look for the adapter.", e)
      return
    } catch (e: IllegalStateException) {
      /* Bluetooth went off between the check above and here. */
      promise.resolve(false)
      return
    }
    synchronized(lock) {
      scanner = le
      scanning = callback
    }
    main.removeCallbacks(scanEnds)
    main.postDelayed(scanEnds, seconds.coerceIn(1, MAX_SCAN_SECONDS) * 1000L)
    promise.resolve(true)
  }

  /* One sighting. A low-latency scan reports the same adapter many times a
     second; the list only goes out again when something new turns up or a
     name changes, while the signal strength is kept fresh for devices(). */
  private fun heard(from: ScanCallback, result: ScanResult) {
    val address = result.device?.address ?: return
    val name = result.scanRecord?.deviceName ?: nameOf(result.device) ?: "Bluetooth MIDI"
    val list = synchronized(lock) {
      if (scanning !== from) return
      val before = found[address]
      found[address] = mapOf("id" to address, "name" to name, "rssi" to result.rssi)
      if (before == null || before["name"] != name) found.values.toList() else null
    }
    if (list != null) sendEvent("onDevices", mapOf("devices" to list))
  }

  private fun stopScanning() {
    main.removeCallbacks(scanEnds)
    val stopping = synchronized(lock) {
      val pair = scanner to scanning
      scanner = null
      scanning = null
      pair
    }
    val le = stopping.first ?: return
    val callback = stopping.second ?: return
    try {
      le.stopScan(callback)
    } catch (e: RuntimeException) {
      /* Bluetooth already off, or permission withdrawn: the scan is over either way. */
      Log.w(TAG, "Bluetooth scan stop: ${e.message}")
    }
  }

  // Connecting

  /* Main thread. Android opens the adapter as a MIDI device of its own and
     answers later, on the main thread. If it never answers (the adapter is out
     of range), the attempt gives up after OPEN_TIMEOUT_MS, and a device that
     turns up after that is closed rather than used. */
  private fun connect(id: String, promise: Promise) {
    val adapter = bluetooth
    val manager = midi
    if (adapter == null || manager == null || !adapter.isEnabled || !BluetoothAdapter.checkBluetoothAddress(id)) {
      promise.resolve(false)
      return
    }
    val current = synchronized(lock) { link }
    if (current != null && current.id == id) {
      sendEvent("onState", mapOf("state" to "connected", "id" to id, "name" to current.name))
      promise.resolve(true)
      return
    }
    /* A scan running alongside slows the connection down, and the adapter has been chosen. */
    stopScanning()
    close()
    val target = adapter.getRemoteDevice(id)
    val name = synchronized(lock) { found[id]?.get("name") as? String } ?: nameOf(target) ?: id
    val mine = synchronized(lock) { ++attempt }
    var settled = false
    val giveUp = Runnable {
      if (!settled) {
        settled = true
        synchronized(lock) { if (attempt == mine) attempt++ }
        promise.resolve(false)
      }
    }
    main.postDelayed(giveUp, OPEN_TIMEOUT_MS)
    try {
      manager.openBluetoothDevice(
        target,
        MidiManager.OnDeviceOpenedListener { opened ->
          main.removeCallbacks(giveUp)
          val wanted = !settled && synchronized(lock) { attempt == mine }
          val ok = wanted && opened != null && adopt(opened, id, name)
          if (!ok) closeQuietly(opened)
          if (!settled) {
            settled = true
            if (ok) sendEvent("onState", mapOf("state" to "connected", "id" to id, "name" to name))
            promise.resolve(ok)
          }
        },
        main
      )
    } catch (e: SecurityException) {
      main.removeCallbacks(giveUp)
      settled = true
      promise.reject("E_PERMISSION", "Bluetooth permission is needed to connect to the adapter.", e)
    }
  }

  /* Port 0 both ways: a Bluetooth MIDI adapter has exactly one of each.
     "Input" is Android's word for the adapter's way in, so it is what we
     send on; we listen on its output. */
  private fun adopt(opened: MidiDevice, id: String, name: String): Boolean {
    val toUnit = opened.openInputPort(0)
    val fromUnit = opened.openOutputPort(0)
    if (toUnit == null || fromUnit == null) {
      closeQuietly(toUnit)
      closeQuietly(fromUnit)
      return false
    }
    /* On the port's own reader thread. Each piece is copied out (the array
       is reused) and handed on unchanged. */
    val listener = object : MidiReceiver() {
      override fun onSend(msg: ByteArray, offset: Int, count: Int, timestamp: Long) {
        if (count <= 0) return
        val bytes = msg.copyOfRange(offset, offset + count).map { it.toInt() and 0xFF }
        main.post { sendEvent("onBytes", mapOf("bytes" to bytes)) }
      }
    }
    fromUnit.connect(listener)
    synchronized(lock) {
      link = Link(id, name, opened, toUnit, fromUnit, listener)
    }
    watch()
    return true
  }

  /* Android tells every app when a MIDI device goes away; for ours, that is
     the adapter dropping out (out of range, switched off, Bluetooth off). */
  @Suppress("DEPRECATION")
  private fun watch() {
    val manager = midi ?: return
    val callback = object : MidiManager.DeviceCallback() {
      override fun onDeviceRemoved(device: MidiDeviceInfo) {
        removed(device)
      }
    }
    val fresh = synchronized(lock) {
      if (watching != null) {
        false
      } else {
        watching = callback
        true
      }
    }
    /* The older form, because the newer one starts at Android 13. */
    if (fresh) manager.registerDeviceCallback(callback, main)
  }

  private fun unwatch() {
    val callback = synchronized(lock) {
      val old = watching
      watching = null
      old
    } ?: return
    midi?.unregisterDeviceCallback(callback)
  }

  private fun removed(device: MidiDeviceInfo) {
    val gone = synchronized(lock) {
      val ours = link ?: return
      if (ours.device.info.id != device.id) return
      ours
    }
    close()
    sendEvent("onState", mapOf("state" to "disconnected", "id" to gone.id, "name" to gone.name, "reason" to "removed"))
  }

  /* Ours to close, so no 'disconnected' goes out: that event means the
     adapter went, and the JavaScript would start reconnecting. Also cancels
     an open still in progress, whose device is then closed when it arrives. */
  private fun close() {
    val old = synchronized(lock) {
      attempt++
      val was = link
      link = null
      was
    } ?: return
    try {
      old.fromUnit.disconnect(old.listener)
    } catch (e: RuntimeException) {
      Log.w(TAG, "MIDI listener: ${e.message}")
    }
    closeQuietly(old.fromUnit)
    closeQuietly(old.toUnit)
    closeQuietly(old.device)
  }

  // Sending

  /* On the JavaScript thread. MidiInputPort.send blocks until the bytes are
     written, which for a SysEx frame of a few dozen bytes is no time at all. */
  private fun send(bytes: List<Int>): Boolean {
    if (bytes.isEmpty() || bytes.any { it !in 0..0xFF }) return false
    val port = synchronized(lock) { link?.toUnit } ?: return false
    val data = ByteArray(bytes.size) { bytes[it].toByte() }
    return try {
      port.send(data, 0, data.size)
      true
    } catch (e: Exception) {
      Log.w(TAG, "MIDI send: ${e.message}")
      false
    }
  }

  // Helpers

  /* A device's name needs "Nearby devices" on Android 12 and newer; without it the scan record's name is used instead. */
  private fun nameOf(device: BluetoothDevice?): String? {
    return try {
      device?.name
    } catch (e: SecurityException) {
      null
    }
  }

  private fun closeQuietly(thing: Closeable?) {
    try {
      thing?.close()
    } catch (e: Exception) {
      Log.w(TAG, "MIDI close: ${e.message}")
    }
  }

  companion object {
    private const val TAG = "FractalBleMidi"

    /* The Bluetooth MIDI service, from the MIDI Association's BLE-MIDI specification. */
    private val MIDI_SERVICE: UUID = UUID.fromString("03B80E5A-EDE8-4B33-A751-6CE34EC4C700")

    private const val MAX_SCAN_SECONDS = 60
    private const val OPEN_TIMEOUT_MS = 15_000L
  }
}
