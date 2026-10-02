Pod::Spec.new do |s|
  s.name           = 'FractalWatch'
  s.version        = '1.0.0'
  s.summary        = 'The iPhone end of the Apple Watch link (WatchConnectivity).'
  s.description    = 'Sends the stage screen to the watch and hands its requests to the app.'
  s.license        = 'MIT'
  s.author         = 'Justin Newbold'
  s.homepage       = 'https://fractal.newbold.cloud'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WatchConnectivity'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
