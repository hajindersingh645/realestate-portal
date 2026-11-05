/** Every route path in the web app. Components link with these, never with string literals. */
export const PATHS = {
  signIn: '/sign-in',
  home: '/',
  me: '/me',
  professional: '/professional',
  requirements: '/requirements',
  newRequirement: '/requirements/new',
  requirement: '/requirements/:id',
  editRequirement: '/requirements/:id/edit',
  myLeads: '/leads',
} as const;

/** `/requirements/:id` (and its edit page) for one requirement. */
export function requirementPath(id: string, edit = false): string {
  return `${PATHS.requirements}/${id}${edit ? '/edit' : ''}`;
}
