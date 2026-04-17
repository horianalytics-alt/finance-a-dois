import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { maskDateBR } from "@/lib/format";

interface Props {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  required?: boolean;
  placeholder?: string;
}

/**
 * Input de data BR com máscara DD/MM/YYYY.
 * Não usa <input type="date"> de propósito (evita conversões UTC).
 */
export const DateInput = forwardRef<HTMLInputElement, Props>(function DateInput(
  { value, onChange, id, required, placeholder = "DD/MM/AAAA" },
  ref,
) {
  return (
    <Input
      ref={ref}
      id={id}
      required={required}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={value}
      maxLength={10}
      onChange={(e) => onChange(maskDateBR(e.target.value))}
    />
  );
});
