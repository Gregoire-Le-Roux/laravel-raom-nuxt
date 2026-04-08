export function snakeCaseToPascalCase(value: string): string {
  const camelCase = value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1)
}
