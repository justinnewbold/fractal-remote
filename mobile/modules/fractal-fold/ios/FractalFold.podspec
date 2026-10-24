Pod::Spec.new do |s|
  s.name           = 'FractalFold'
  s.version        = '1.0.0'
  s.summary        = 'The iPhone Duo\'s hinge and fold, as the app sees them: reported, and nothing more.'
  s.description    = 'Reads the hinge, the fold, what covers the screen, the window and the side bar\'s edge on iOS 27.1, and hands them to the JavaScript.'
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
