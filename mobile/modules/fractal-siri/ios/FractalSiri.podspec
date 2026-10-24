Pod::Spec.new do |s|
  s.name           = 'FractalSiri'
  s.version        = '1.0.0'
  s.summary        = 'Siri\'s hand-off to the app: each command and when it arrived, and the app\'s words back.'
  s.description    = 'Carries a Siri command from the App Shortcuts in the iPhone app to the JavaScript, and its answer back to Siri.'
  s.license        = 'MIT'
  s.author         = 'Justin Newbold'
  s.homepage       = 'https://fractal.newbold.cloud'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
