interface StatusToggleProps {
    isActive: boolean;
    onToggle: (isActive: boolean) => void;
    disabled?: boolean;
}

export function StatusToggle({ isActive, onToggle, disabled }: StatusToggleProps) {
    return (
        <button
            type="button"
            onClick={() => onToggle(!isActive)}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
                isActive ? 'bg-indigo-600' : 'bg-gray-200'
            }`}
            role="switch"
            aria-checked={isActive}
        >
            <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isActive ? 'translate-x-5' : 'translate-x-0'
                }`}
            />
        </button>
    );
}
