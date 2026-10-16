export type FormErrorProps = {
  id?: string;
  message?: string | null;
};

export const FormError = ({ id, message }: FormErrorProps) => {
  if (!message) return null;

  return (
    <p id={id} role="alert" className="text-sm font-medium text-destructive">
      {message}
    </p>
  );
};
