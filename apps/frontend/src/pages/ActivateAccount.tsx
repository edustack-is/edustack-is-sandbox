import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { acceptInvitation } from '../api';
import { toast } from 'sonner';
import { PasswordInput } from '../components/ui/password-input';
import { validatePassword } from '../lib/password-utils';

export const ActivateAccount = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: '',
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token) {
            toast.error('Chybí aktivační token.');
            return;
        }

        const validation = validatePassword(formData.password);
        if (!validation.isValid) {
            toast.error(validation.errors[0]);
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            toast.error('Hesla se neshodují.');
            return;
        }

        setLoading(true);
        try {
            const res = await acceptInvitation({
                token,
                password: formData.password
            });

            // Save token and redirect
            localStorage.setItem('access_token', res.access_token);
            toast.success('Účet byl úspěšně aktivován.');
            window.location.href = '/select-school';
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Aktivace selhala';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="max-w-md w-full bg-white p-8 rounded shadow text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">Neplatný odkaz</h2>
                    <p className="text-gray-600">Aktivační odkaz je neplatný nebo mu vypršela platnost.</p>
                    <a href="/login" className="mt-4 inline-block text-indigo-600 hover:text-indigo-500">
                        Zpět na přihlášení
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded shadow">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Aktivace účtu
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Nastavte si heslo ke svému novému účtu.
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div className="mb-4">
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                Nové heslo
                            </label>
                            <PasswordInput
                                id="password"
                                name="password"
                                required
                                value={formData.password}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                Potvrzení hesla
                            </label>
                            <PasswordInput
                                id="confirmPassword"
                                name="confirmPassword"
                                required
                                showStrength={false}
                                value={formData.confirmPassword}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {loading ? 'Aktivuji...' : 'Aktivovat účet'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
