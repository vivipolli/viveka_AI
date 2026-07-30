import logoImg from "../../logo2.jpeg";

interface Props {
  className?: string;
}

export function Logo({ className = "h-11 w-11" }: Props) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border-2 border-white bg-white shadow-md ${className}`}
    >
      <img
        src={logoImg}
        alt="Viveka"
        className="h-full w-full rounded-full object-cover"
      />
    </div>
  );
}
