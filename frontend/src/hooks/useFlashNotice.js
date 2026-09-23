import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// One-time message passed with navigate(path, { state: { notice: 'Course created' } }).
// It is cleared from the history entry so a refresh does not show it again.
export default function useFlashNotice() {
  const location = useLocation();
  const navigate = useNavigate();
  const [notice, setNotice] = useState(location.state?.notice || '');

  useEffect(() => {
    if (location.state?.notice) {
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }
  }, [location, navigate]);

  return [notice, setNotice];
}
