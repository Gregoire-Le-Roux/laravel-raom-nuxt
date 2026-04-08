export function pascaleCaseToSnakeCase(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
}
