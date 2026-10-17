import { useNavigate } from 'react-router-dom';

/** Goes back in this tab's history, or home when the page was opened directly. */
export function BackButton() {
  const navigate = useNavigate();
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
  return (
    <button className="back" onClick={() => (idx > 0 ? navigate(-1) : navigate('/'))}>← Back</button>
  );
}
