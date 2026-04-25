interface Props {
  message: string;
  recipientName: string;
}

export function MessagePreview({ message, recipientName }: Props) {
  return (
    <div className="bg-surface2 border border-border rounded-lg p-4">
      <div className="text-xs text-muted mb-2">대상: {recipientName}</div>
      <pre className="whitespace-pre-wrap text-sm font-sans">{message}</pre>
    </div>
  );
}
