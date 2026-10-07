import { useEffect, useRef } from 'react';

type PostaComposeRichEditorProps = {
  html: string;
  disabled?: boolean;
  onChange: (html: string) => void;
};

function runCommand(command: string, value?: string) {
  try {
    document.execCommand(command, false, value);
  } catch {
    /* tarayıcı desteği */
  }
}

export function PostaComposeRichEditor({ html, disabled, onChange }: PostaComposeRichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastSynced = useRef('');

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (html === lastSynced.current) return;
    el.innerHTML = html?.trim() ? html : '<p><br></p>';
    lastSynced.current = html;
  }, [html]);

  const emitChange = () => {
    const next = editorRef.current?.innerHTML ?? '';
    lastSynced.current = next;
    onChange(next);
  };

  const insertLink = () => {
    const url = window.prompt('Bağlantı URL (https://…)', 'https://');
    if (!url?.trim()) return;
    runCommand('createLink', url.trim());
    editorRef.current?.focus();
    emitChange();
  };

  return (
    <>
      <div className="posta-compose-toolbar posta-compose-toolbar--rte" role="toolbar" aria-label="Zengin metin">
        <button type="button" className="btn btn-sm btn-outline" disabled={disabled} onClick={() => { runCommand('bold'); emitChange(); }}>
          Kalın
        </button>
        <button type="button" className="btn btn-sm btn-outline" disabled={disabled} onClick={() => { runCommand('italic'); emitChange(); }}>
          İtalik
        </button>
        <button type="button" className="btn btn-sm btn-outline" disabled={disabled} onClick={() => { runCommand('underline'); emitChange(); }}>
          Altı çizili
        </button>
        <button type="button" className="btn btn-sm btn-outline" disabled={disabled} onClick={() => { runCommand('strikeThrough'); emitChange(); }}>
          Üstü çizili
        </button>
        <button type="button" className="btn btn-sm btn-outline" disabled={disabled} onClick={() => { runCommand('insertUnorderedList'); emitChange(); }}>
          Liste
        </button>
        <button type="button" className="btn btn-sm btn-outline" disabled={disabled} onClick={() => { runCommand('insertOrderedList'); emitChange(); }}>
          Numaralı
        </button>
        <button type="button" className="btn btn-sm btn-outline" disabled={disabled} onClick={() => { runCommand('formatBlock', 'h2'); emitChange(); }}>
          Başlık
        </button>
        <button type="button" className="btn btn-sm btn-outline" disabled={disabled} onClick={() => { runCommand('formatBlock', 'blockquote'); emitChange(); }}>
          Alıntı
        </button>
        <button type="button" className="btn btn-sm btn-outline" disabled={disabled} onClick={insertLink}>
          Link
        </button>
        <button type="button" className="btn btn-sm btn-outline" disabled={disabled} onClick={() => { runCommand('removeFormat'); emitChange(); }}>
          Biçimi temizle
        </button>
      </div>
      <div
        ref={editorRef}
        className="posta-compose-rte"
        contentEditable={!disabled}
        role="textbox"
        aria-multiline="true"
        data-placeholder="Mesajınızı yazın…"
        suppressContentEditableWarning
        onInput={emitChange}
        onBlur={emitChange}
      />
    </>
  );
}
