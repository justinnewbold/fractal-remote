Pod::Spec.new do |s|
  s.name           = 'FractalBleMidi'
  s.version        = '1.0.0'
  s.summary        = 'The phone end of a Bluetooth MIDI adapter on the unit (CoreMIDI).'
  s.description    = 'Pairs a Bluetooth MIDI adapter with Apple\'s own screen and carries MIDI bytes to and from it.'
  s.license        = 'MIT'
  s.author         = 'Justin Newbold'
  s.homepage       = 'https://fractal.newbold.cloud'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CoreMIDI', 'CoreAudioKit'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
