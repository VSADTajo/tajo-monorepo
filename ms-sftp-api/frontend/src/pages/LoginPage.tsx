import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface LoginForm {
    email: string;
    password: string;
}

export function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        setError,
    } = useForm<LoginForm>();

    const onSubmit = async ({ email, password }: LoginForm) => {
        try {
            await login(email, password);
            navigate('/');
        } catch {
            setError('root', { message: 'Email o contraseña inválidos' });
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-semibold text-white">SFTP Manager</h1>
                    <p className="text-sm text-gray-400 mt-1">File Mapping Engine</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="bg-gray-800 rounded-lg p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                        <input
                            {...register('email', { required: 'El email es obligatorio' })}
                            type="email"
                            placeholder="usuario@ejemplo.com"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {errors.email && (
                            <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Contraseña</label>
                        <input
                            {...register('password', { required: 'La contraseña es obligatoria' })}
                            type="password"
                            placeholder="••••••••"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {errors.password && (
                            <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
                        )}
                    </div>

                    {errors.root && (
                        <div className="bg-red-900/50 border border-red-700 rounded-md px-3 py-2">
                            <p className="text-sm text-red-300">{errors.root.message}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
                    >
                        {isSubmitting ? 'Ingresando...' : 'Ingresar'}
                    </button>
                </form>
            </div>
        </div>
    );
}
