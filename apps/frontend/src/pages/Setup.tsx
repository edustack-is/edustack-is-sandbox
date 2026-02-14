import { useState } from 'react';
import { setupApp } from '../api';
import { PasswordInput } from '../components/ui/password-input';
import { validatePassword } from '../lib/password-utils';

export const Setup = () => {
    const [formData, setFormData] = useState({
        adminFirstName: '',
        adminLastName: '',
        adminEmail: '',
        adminPassword: '',
        confirmPassword: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const validation = validatePassword(formData.adminPassword);
        if (!validation.isValid) {
            setError(validation.errors[0]);
            return;
        }

        if (formData.adminPassword !== formData.confirmPassword) {
            setError('Hesla se neshodují');
            return;
        }

        setLoading(true);
        try {
            await setupApp(formData);
            window.location.href = '/login';
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Setup failed';
            if (msg.includes('already initialized') || err.response?.status === 403) {
                window.location.href = '/login';
                return;
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded shadow">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        System Setup
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Create System Administrator
                    </p>
                </div>
                {error && <div className="text-red-500 text-sm text-center">{error}</div>}

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div className="mb-4">
                            <label htmlFor="adminFirstName" className="block text-sm font-medium text-gray-700">First Name</label>
                            <input
                                id="adminFirstName"
                                name="adminFirstName"
                                type="text"
                                required
                                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                value={formData.adminFirstName}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="adminLastName" className="block text-sm font-medium text-gray-700">Last Name</label>
                            <input
                                id="adminLastName"
                                name="adminLastName"
                                type="text"
                                required
                                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                value={formData.adminLastName}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700">Admin Email</label>
                            <input
                                id="adminEmail"
                                name="adminEmail"
                                type="email"
                                required
                                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                value={formData.adminEmail}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700 mb-1">Heslo</label>
                            <PasswordInput
                                id="adminPassword"
                                name="adminPassword"
                                required
                                value={formData.adminPassword}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Potvrzení hesla</label>
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
                            {loading ? 'Creating...' : 'Create System Admin'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
