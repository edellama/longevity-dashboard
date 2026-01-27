interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  color: "green" | "blue" | "purple" | "orange";
}

const colorClasses = {
  green: "bg-green-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
};

export default function MetricCard({ title, value, subtitle, color }: MetricCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-l-4 border-indigo-500">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            {title}
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {value}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {subtitle}
          </p>
        </div>
        <div className={`w-12 h-12 rounded-full ${colorClasses[color]} opacity-20`}></div>
      </div>
    </div>
  );
}
