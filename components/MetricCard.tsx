interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  color: "green" | "blue" | "purple" | "orange";
}

const gradientByColor = {
  green:
    "from-emerald-50 to-teal-50 dark:from-slate-800 dark:to-slate-800/90 border-l-emerald-500",
  blue:
    "from-sky-50 to-cyan-50 dark:from-slate-800 dark:to-slate-800/90 border-l-sky-500",
  purple:
    "from-violet-50 to-purple-50 dark:from-slate-800 dark:to-slate-800/90 border-l-violet-500",
  orange:
    "from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-800/90 border-l-amber-500",
};

export default function MetricCard({
  title,
  value,
  subtitle,
  color,
}: MetricCardProps) {
  return (
    <div
      className={`rounded-2xl border-l-4 bg-gradient-to-br shadow-md p-6 border border-slate-200/80 dark:border-slate-600/50 ${gradientByColor[color]}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
            {title}
          </p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
            {value}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {subtitle}
          </p>
        </div>
        <div
          className={`w-12 h-12 rounded-full opacity-20 ${
            color === "green"
              ? "bg-emerald-500"
              : color === "blue"
              ? "bg-sky-500"
              : color === "purple"
              ? "bg-violet-500"
              : "bg-amber-500"
          }`}
        />
      </div>
    </div>
  );
}
