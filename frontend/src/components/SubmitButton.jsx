import Button from './Button.jsx';
import { Spinner } from './Loader.jsx';

export default function SubmitButton({ loading, loadingText, children }) {
  return (
    <Button type="submit" variant="primary" full disabled={loading} aria-busy={loading || undefined}>
      {loading && <Spinner />}
      {loading ? loadingText : children}
    </Button>
  );
}
