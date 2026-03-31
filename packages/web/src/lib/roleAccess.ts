/** Facility actions restricted to org administrators (super admins bypass on the API). */
export function canAddResidents(role: string | undefined) {
  return role === "orgAdmin" || role === "superAdmin"
}
