import Alert from './Alert.jsx';

// Consistent wrapper for a failed API/data load, as opposed to Alert used directly
// for form validation and success/info notices. Renders nothing without a message.
export default function ErrorMessage({ children }) {
  if (!children) return null;
  return <Alert type="error">{children}</Alert>;
}
