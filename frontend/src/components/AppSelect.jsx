import Select from "react-select";
import CreatableSelect from "react-select/creatable";

const buildStyles = (size) => ({
  control: (base, state) => ({
    ...base,
    minHeight: size === "sm" ? "40px" : "42px",
    borderRadius: "0.75rem",
    borderColor: state.isFocused ? "#0E5A7C" : "#e2e8f0",
    backgroundColor: state.isDisabled ? "#f1f5f9" : "#ffffff",
    boxShadow: state.isFocused
      ? "0 0 0 4px rgba(14, 90, 124, 0.1)"
      : "0 1px 2px 0 rgba(15, 23, 42, 0.04)",
    fontSize: "0.875rem",
    cursor: state.isDisabled ? "not-allowed" : "pointer",
    transition: "all 150ms ease",
    "&:hover": {
      borderColor: state.isFocused ? "#0E5A7C" : "#cbd5e1",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: size === "sm" ? "2px 10px" : "3px 12px",
    gap: "4px",
  }),
  placeholder: (base) => ({
    ...base,
    color: "#94a3b8",
  }),
  singleValue: (base) => ({
    ...base,
    color: "#1e293b",
    fontWeight: 500,
  }),
  input: (base) => ({
    ...base,
    color: "#1e293b",
    margin: 0,
    padding: 0,
  }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? "#0E5A7C" : "#94a3b8",
    padding: "6px 8px",
    transition: "transform 150ms ease, color 150ms ease",
    transform: state.selectProps.menuIsOpen ? "rotate(180deg)" : undefined,
    "&:hover": { color: "#0E5A7C" },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "#94a3b8",
    padding: "4px",
    "&:hover": { color: "#e11d48" },
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999,
  }),
  menu: (base) => ({
    ...base,
    borderRadius: "0.875rem",
    border: "1px solid #e2e8f0",
    boxShadow: "0 16px 32px -8px rgba(15, 23, 42, 0.14), 0 4px 12px -4px rgba(14, 90, 124, 0.08)",
    overflow: "hidden",
    padding: "4px",
    marginTop: "6px",
  }),
  menuList: (base) => ({
    ...base,
    padding: 0,
    maxHeight: "240px",
  }),
  option: (base, state) => ({
    ...base,
    borderRadius: "0.55rem",
    fontSize: "0.875rem",
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: state.isSelected ? 600 : 500,
    backgroundColor: state.isSelected
      ? "#0E5A7C"
      : state.isFocused
      ? "#E6F1F6"
      : "transparent",
    color: state.isSelected ? "#ffffff" : state.isFocused ? "#0E5A7C" : "#334155",
    "&:active": {
      backgroundColor: state.isSelected ? "#0A4259" : "#d5e8f1",
    },
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: "#E6F1F6",
    borderRadius: "0.5rem",
    padding: "1px 2px",
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: "#0E5A7C",
    fontWeight: 600,
    fontSize: "0.78rem",
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: "#0E5A7C",
    borderRadius: "0.375rem",
    "&:hover": {
      backgroundColor: "#0E5A7C",
      color: "#ffffff",
    },
  }),
  noOptionsMessage: (base) => ({
    ...base,
    fontSize: "0.85rem",
    color: "#94a3b8",
  }),
});

export default function AppSelect({
  options = [],
  value,
  onChange,
  placeholder = "Pilih...",
  isMulti = false,
  isClearable = false,
  isSearchable = true,
  isDisabled = false,
  isCreatable = false,
  isLoading = false,
  onCreateOption,
  formatCreateLabel,
  size = "md",
  className = "",
  ...rest
}) {
  const resolvedValue = isMulti
    ? options.filter((o) => Array.isArray(value) && value.some((v) => String(v) === String(o.value)))
    : options.find((o) => String(o.value) === String(value ?? "")) ||
      (value ? { value, label: String(value) } : null);

  const handleChange = (selected) => {
    if (isMulti) {
      onChange?.((selected || []).map((o) => o.value));
    } else {
      onChange?.(selected ? selected.value : "");
    }
  };

  const Component = isCreatable ? CreatableSelect : Select;

  return (
    <Component
      className={className}
      classNamePrefix="taxora-select"
      options={options}
      value={resolvedValue}
      onChange={handleChange}
      onCreateOption={isCreatable ? onCreateOption : undefined}
      formatCreateLabel={isCreatable ? formatCreateLabel || ((v) => `+ Tambah "${v}"`) : undefined}
      placeholder={placeholder}
      isMulti={isMulti}
      isClearable={isClearable}
      isSearchable={isSearchable}
      isDisabled={isDisabled}
      isLoading={isLoading}
      closeMenuOnSelect={!isMulti}
      noOptionsMessage={() => "Tidak ada pilihan"}
      menuPortalTarget={typeof document !== "undefined" ? document.body : null}
      menuPosition="fixed"
      styles={buildStyles(size)}
      {...rest}
    />
  );
}
