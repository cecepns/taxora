import DatePicker, { registerLocale } from "react-datepicker";
import { format, isValid, parseISO } from "date-fns";
import { id } from "date-fns/locale/id";
import { CalendarDays } from "lucide-react";
import "react-datepicker/dist/react-datepicker.css";

registerLocale("id", id);

export default function AppDatePicker({
  value = "",
  onChange,
  placeholder = "Pilih tanggal",
  isClearable = false,
  required = false,
  disabled = false,
  className = "",
  minDate,
  maxDate,
}) {
  const parsed = value ? parseISO(value) : null;
  const selected = parsed && isValid(parsed) ? parsed : null;

  const handleChange = (date) => {
    onChange?.(date && isValid(date) ? format(date, "yyyy-MM-dd") : "");
  };

  return (
    <div className={`relative ${className}`}>
      <CalendarDays
        size={16}
        className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400"
      />
      <DatePicker
        selected={selected}
        onChange={handleChange}
        locale="id"
        dateFormat="dd MMM yyyy"
        placeholderText={placeholder}
        isClearable={isClearable}
        required={required}
        disabled={disabled}
        minDate={minDate}
        maxDate={maxDate}
        portalId="datepicker-portal"
        autoComplete="off"
        className={`input pl-10 ${isClearable && selected ? "pr-9" : ""}`}
      />
    </div>
  );
}
