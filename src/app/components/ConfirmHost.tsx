import { useEffect, useState } from 'react';
import { setConfirmPresenter, type Request } from './confirm';
import { EditorSheet } from './EditorSheet';

export function ConfirmHost() {
  const [request, setRequest] = useState<Request | null>(null);

  useEffect(() => {
    setConfirmPresenter(setRequest);
    return () => setConfirmPresenter(null);
  }, []);

  if (!request) return null;

  const answer = (value: boolean | null) => {
    request.resolve(value);
    setRequest(null);
  };

  return (
    <EditorSheet title={request.title} onClose={() => answer(null)}>
      {request.body && <p className="confirm-body">{request.body}</p>}
      <div className="confirm-actions">
        <button
          type="button"
          className={`primary${request.danger ? ' is-danger' : ''}`}
          onClick={() => answer(true)}
        >
          {request.confirm}
        </button>
        <button type="button" className="confirm-cancel" onClick={() => answer(false)}>
          {request.cancel ?? 'Отмена'}
        </button>
      </div>
    </EditorSheet>
  );
}
