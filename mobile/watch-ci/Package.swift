// swift-tools-version:5.9
//
// The watch's reading of what the phone sends, tested on its own on a Mac
// runner (.github/workflows/watch.yml). Model.swift here is a link to the
// watch app's own file, so there is one copy of it.
import PackageDescription

let package = Package(
    name: "WatchModel",
    platforms: [.macOS(.v13)],
    targets: [
        .target(name: "WatchModel", path: "Sources/WatchModel"),
        .testTarget(
            name: "WatchModelTests",
            dependencies: ["WatchModel"],
            path: "Tests/WatchModelTests",
            resources: [.copy("state.json")]
        )
    ]
)
