const { defaults: tsjPreset } = require("ts-jest/presets")

const thirdPartyIgnorePatterns = [
  "((jest-)?react-native|@react-native(-community)?)",
  "expo(nent)?",
  "@expo(nent)?/.*",
  "@expo-google-fonts/.*",
  "react-navigation",
  "@react-navigation/.*",
  "@unimodules/.*",
  "unimodules",
  "sentry-expo",
  "native-base",
  "react-native-svg",
  "react-clone-referenced-element",
  "react-native-code-push",
  "react-redux", // Add this line
];

// /** @type {import('@jest/types').Config.ProjectConfig} */
// module.exports = {
//   ...tsjPreset,
//   preset: "jest-expo",
//   transformIgnorePatterns: [
//     `<rootDir>/node_modules/(?!${thirdPartyIgnorePatterns.join("|")})`,
//     "jest-runner",
//   ],
//   testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.maestro/", "@react-native"],
//   setupFiles: ["<rootDir>/test/setup.ts"],
//   transform:{
//     '^.+\\.test.tsx?$': ['ts-jest', {
//       tsconfig: '<rootDir>/test/test-tsconfig.json'
//     }]
//   }
// }
module.exports = {
  ...tsjPreset,
  preset: "jest-expo",
  transformIgnorePatterns: [
    "jest-runner",
    `<rootDir>/node_modules/(?!${thirdPartyIgnorePatterns.join("|")})`,
  ],
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.maestro/", "@react-native"],
  setupFiles: ["<rootDir>/test/setup.ts"],
  transform: {
    '^.+\\.test.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/test/test-tsconfig.json',      
      diagnostics: false,
      isolatedModules: true,
    }],
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.js$': 'babel-jest',
  }
}