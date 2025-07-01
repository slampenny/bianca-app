import { Platform } from "react-native"

export function testingProps(testKey?: string) {
    if (!testKey) return {}
    return Platform.select({
      web: { "data-testid": testKey },
      default: { testID: testKey },
    })
}
