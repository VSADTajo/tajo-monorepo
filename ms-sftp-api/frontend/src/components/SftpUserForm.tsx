import { useForm } from 'react-hook-form';

export interface SftpUserFormData {
    username: string;
    password: string;
    rootDirectory: string;
}

interface SftpUserFormProps {
    defaultValues?: Partial<SftpUserFormData>;
    onSubmit: (data: SftpUserFormData) => void;
    isSubmitting: boolean;
    submitLabel: string;
    isEditing?: boolean;
}

export function SftpUserForm({ defaultValues, onSubmit, isSubmitting, submitLabel, isEditing }: SftpUserFormProps) {
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<SftpUserFormData>({
        defaultValues: {
            username: '',
            password: '',
            rootDirectory: '',
            ...defaultValues,
        },
    });

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-medium text-gray-900">User Configuration</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Username */}
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                            Username
                        </label>
                        <input
                            id="username"
                            type="text"
                            placeholder="empresa-x"
                            disabled={isEditing}
                            className={`mt-1 block w-full border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                                isEditing ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                            }`}
                            {...register('username', {
                                required: !isEditing ? 'Username is required' : false,
                            })}
                        />
                        {errors.username && (
                            <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
                        )}
                    </div>

                    {/* Root Directory */}
                    <div>
                        <label htmlFor="rootDirectory" className="block text-sm font-medium text-gray-700">
                            Root Directory
                        </label>
                        <input
                            id="rootDirectory"
                            type="text"
                            placeholder="empresa-x"
                            className="mt-1 block w-full border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            {...register('rootDirectory', {
                                required: !isEditing ? 'Root directory is required' : false,
                            })}
                        />
                        {errors.rootDirectory && (
                            <p className="mt-1 text-sm text-red-600">{errors.rootDirectory.message}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                            Subdirectory within the storage base path where this user's files are stored.
                        </p>
                    </div>

                    {/* Password */}
                    <div className="md:col-span-2">
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            placeholder={isEditing ? 'Leave empty to keep current password' : 'Enter password'}
                            className="mt-1 block w-full border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            {...register('password', {
                                required: !isEditing ? 'Password is required' : false,
                                minLength: !isEditing
                                    ? { value: 6, message: 'Password must be at least 6 characters' }
                                    : undefined,
                            })}
                        />
                        {errors.password && (
                            <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                        )}
                        {isEditing && (
                            <p className="mt-1 text-xs text-gray-500">
                                Leave empty to keep the current password.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-end space-x-3">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 px-6 py-2 rounded-md text-sm font-medium"
                >
                    {isSubmitting ? 'Saving...' : submitLabel}
                </button>
            </div>
        </form>
    );
}
