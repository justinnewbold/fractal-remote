package cloud.newbold.fractalremote.blemidi

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
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
import android.os.SystemClock
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
 *                        — 'connected' once the phone really has a Bluetooth
 *                          link to the adapter (not merely when Android hands
 *                          the device over: see connect); 'disconnected' when
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
  ) {
    /* False from the moment Android hands the device over until the
       Bluetooth link under it is up (see connect). Nothing is sent and no
       'disconnected' goes out until then. Only touched while holding `lock`. */
    var ready = false
  }

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

  private val bluetoothManager: BluetoothManager?
    get() = context?.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager

  private val bluetooth: BluetoothAdapter?
    get() = bluetoothManager?.adapter

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

  /* Main thread. Android hands the adapter over as a MIDI device of its own
     almost at once, and that proves nothing: its Bluetooth MIDI service only
     starts connecting at that moment, and gives the device out straight away
     whether the adapter is there or not. Until the link is up, anything sent
     waits in Android's queue and nothing can come back.

     So the attempt (Opening) stays open after the device arrives, and only
     says 'connected' once the phone has a real Bluetooth link to the adapter
     and Android has had LINK_SETTLE_MS to find the MIDI service on it and
     switch on its replies. If that never happens (the adapter is off, out of
     range, or the unit powering it is off), the attempt gives up after
     OPEN_TIMEOUT_MS, lets go of the device and answers false, and the
     JavaScript's own retry takes it from there. A device that turns up after
     that is closed rather than used. */
  private fun connect(id: String, promise: Promise) {
    val adapter = bluetooth
    val manager = midi
    if (adapter == null || manager == null || !adapter.isEnabled || !BluetoothAdapter.checkBluetoothAddress(id)) {
      promise.resolve(false)
      return
    }
    val current = synchronized(lock) { link?.takeIf { it.ready } }
    if (current != null && current.id == id) {
      sendEvent("onState", mapOf("state" to "connected", "id" to id, "name" to current.name))
      promise.resolve(true)
      return
    }
    /* A scan running alongside slows the connection down, and the adapter has
       been chosen. This also cancels an attempt still under way. */
    stopScanning()
    close()
    val target = adapter.getRemoteDevice(id)
    val name = synchronized(lock) { found[id]?.get("name") as? String } ?: nameOf(target) ?: id
    val mine = synchronized(lock) { ++attempt }
    val opening = Opening(id, name, target, mine, promise)
    main.postDelayed(opening.giveUp, OPEN_TIMEOUT_MS)
    try {
      manager.openBluetoothDevice(
        target,
        MidiManager.OnDeviceOpenedListener { opening.opened(it) },
        main
      )
    } catch (e: SecurityException) {
      opening.refuse(e)
    }
  }

  /* One call to connect(), from asking Android for the device to the answer.
     Main thread only, like everything that drives it, so `settled` needs no
     lock. `attempt` moving past `mine` means the JavaScript has asked for
     something else since (disconnect, or another connect), and whoever moved
     it has closed what this attempt had. */
  private inner class Opening(
    private val id: String,
    private val name: String,
    private val target: BluetoothDevice,
    private val mine: Int,
    private val promise: Promise
  ) {
    private var settled = false
    /* When the Bluetooth link was first seen up, or 0 while it is not. */
    private var linkedAt = 0L

    val giveUp = Runnable { fail() }
    private val check = Runnable { poll() }

    private fun current() = synchronized(lock) { attempt == mine }

    /* Android's answer to openBluetoothDevice: the device, or null. */
    fun opened(device: MidiDevice?) {
      if (settled || device == null || !adopt(device, id, name, mine)) {
        closeQuietly(device)
        fail()
        return
      }
      poll()
    }

    /* Every POLL_MS, until the link has been up for LINK_SETTLE_MS without a
       break, or the attempt ends. */
    private fun poll() {
      if (settled) return
      if (!current()) {
        fail()
        return
      }
      val up = try {
        linkUp(target)
      } catch (e: SecurityException) {
        refuse(e)
        return
      }
      val now = SystemClock.uptimeMillis()
      linkedAt = if (!up) 0L else if (linkedAt == 0L) now else linkedAt
      if (up && now - linkedAt >= LINK_SETTLE_MS) {
        ready()
      } else {
        main.postDelayed(check, POLL_MS)
      }
    }

    private fun ready() {
      val live = synchronized(lock) {
        val ours = link
        if (attempt == mine && ours != null) {
          ours.ready = true
          true
        } else {
          false
        }
      }
      if (!live) {
        fail()
        return
      }
      settled = true
      main.removeCallbacks(giveUp)
      main.removeCallbacks(check)
      sendEvent("onState", mapOf("state" to "connected", "id" to id, "name" to name))
      promise.resolve(true)
    }

    /* Out of time, cancelled, or no device came. */
    fun fail() {
      if (end()) promise.resolve(false)
    }

    fun refuse(e: SecurityException) {
      if (end()) promise.reject("E_PERMISSION", "Bluetooth permission is needed to connect to the adapter.", e)
    }

    /* True only the first time. Lets go of whatever this attempt still holds;
       moving `attempt` on (close does) also means a device that arrives after
       this is closed rather than used. */
    private fun end(): Boolean {
      if (settled) return false
      settled = true
      main.removeCallbacks(giveUp)
      main.removeCallbacks(check)
      if (current()) close()
      return true
    }
  }

  /* Whether the phone has a Bluetooth link to this adapter at all. Android's
     MIDI service makes that link in a process of its own, so this asks the
     Bluetooth service, which knows every app's links. A link some other app
     holds to the adapter counts too; that is rare, and the MIDI service's own
     connection over it is then quick. Throws SecurityException without
     "Nearby devices" on Android 12 and newer. */
  private fun linkUp(device: BluetoothDevice): Boolean {
    val manager = bluetoothManager ?: return false
    return manager.getConnectionState(device, BluetoothProfile.GATT) == BluetoothProfile.STATE_CONNECTED
  }

  /* Port 0 both ways: a Bluetooth MIDI adapter has exactly one of each.
     "Input" is Android's word for the adapter's way in, so it is what we
     send on; we listen on its output. False if the ports would not open, or
     if attempt `mine` is no longer the one wanted; either way nothing is kept
     and the caller closes the device. */
  private fun adopt(opened: MidiDevice, id: String, name: String, mine: Int): Boolean {
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
    /* The check and the keeping happen under one lock. disconnect() runs on
       the JavaScript thread and can land at any moment before this: it moves
       `attempt` on and, finding no link yet, has nothing else to close. Were
       the check made earlier, the link would be stored after it and stay open
       after the JavaScript had asked to drop it. */
    val kept = synchronized(lock) {
      if (attempt == mine) {
        link = Link(id, name, opened, toUnit, fromUnit, listener)
        true
      } else {
        false
      }
    }
    if (!kept) {
      release(toUnit, fromUnit, listener)
      return false
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

  /* Main thread. A device that goes before its link was ever up (Android
     gave up on the Bluetooth connection, or Bluetooth was switched off) was
     never reported connected, so no 'disconnected' goes out for it either:
     closing it moves `attempt` on, and the attempt still waiting in connect()
     answers false. */
  private fun removed(device: MidiDeviceInfo) {
    val gone = synchronized(lock) {
      val ours = link ?: return
      if (ours.device.info.id != device.id) return
      ours to ours.ready
    }
    close()
    if (!gone.second) return
    val was = gone.first
    sendEvent("onState", mapOf("state" to "disconnected", "id" to was.id, "name" to was.name, "reason" to "removed"))
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
    release(old.toUnit, old.fromUnit, old.listener)
    closeQuietly(old.device)
  }

  /* Stops listening and closes both ports. The device is the caller's. */
  private fun release(toUnit: MidiInputPort, fromUnit: MidiOutputPort, listener: MidiReceiver) {
    try {
      fromUnit.disconnect(listener)
    } catch (e: RuntimeException) {
      Log.w(TAG, "MIDI listener: ${e.message}")
    }
    closeQuietly(fromUnit)
    closeQuietly(toUnit)
  }

  // Sending

  /* On the JavaScript thread. MidiInputPort.send blocks until the bytes are
     written, which for a SysEx frame of a few dozen bytes is no time at all.
     Refused until the link is up: before that, Android would only queue the
     bytes, with nothing to send them on. */
  private fun send(bytes: List<Int>): Boolean {
    if (bytes.isEmpty() || bytes.any { it !in 0..0xFF }) return false
    val port = synchronized(lock) { link?.takeIf { it.ready }?.toUnit } ?: return false
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

    /* The whole of connect(): Android handing the device over, the Bluetooth
       link coming up, and LINK_SETTLE_MS after it. */
    private const val OPEN_TIMEOUT_MS = 15_000L

    /* How often connect() asks whether the Bluetooth link is up yet. */
    private const val POLL_MS = 200L

    /* How long the link has to have been up before it is reported connected.
       Android's MIDI service finds the MIDI service on the adapter, reads it,
       asks for bigger packets and switches its replies on, one after another,
       once the link is made; a probe sent before that is lost. Nothing tells
       an app when it has finished, so this is a measured guess. */
    private const val LINK_SETTLE_MS = 1_000L
  }
}
