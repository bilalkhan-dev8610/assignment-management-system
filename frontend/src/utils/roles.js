// Where each role lands after signing in.
export const homePathFor = (role) => (role === 'professor' ? '/professor' : '/student');
