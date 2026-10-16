import React, { useState } from 'react';

export default function RegisterPage() {
    const [role, setRole] = useState<'STUDENT' | 'ADMIN'>('STUDENT');
    const [formData, setFormData] = useState({
        studentId: '',
        email: '',
        name: '',
        password: '',
        adminSecretKey: '', // Security check for admin registration
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            const response = await fetch('https://your-backend-url.vercel.app/api/v1/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role, ...formData }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Registration failed');

            setSuccess('Registration successful! You can now log in.');
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-[#07090e] flex items-center justify-center p-6 text-white">
            <div className="bg-[#0b0f19] border border-gray-800 p-8 rounded-2xl w-full max-w-md shadow-2xl">
                <h2 className="text-2xl font-bold mb-2">Create an Account</h2>
                <p className="text-gray-400 text-sm mb-6">Register to access your portal dashboard.</p>

                {/* Role Toggle Switcher */}
                <div className="flex bg-gray-900 p-1 rounded-xl mb-6 border border-gray-800">
                    <button
                        type="button"
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${role === 'STUDENT' ? 'bg-amber-500 text-black font-semibold' : 'text-gray-400 hover:text-white'
                            }`}
                        onClick={() => setRole('STUDENT')}
                    >
                        Student
                    </button>
                    <button
                        type="button"
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${role === 'ADMIN' ? 'bg-amber-500 text-black font-semibold' : 'text-gray-400 hover:text-white'
                            }`}
                        onClick={() => setRole('ADMIN')}
                    >
                        College Admin
                    </button>
                </div>

                {error && <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-lg text-sm mb-4">{error}</div>}
                {success && <div className="bg-green-500/10 border border-green-500 text-green-400 p-3 rounded-lg text-sm mb-4">{success}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {role === 'STUDENT' ? (
                        <div>
                            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">College-Issued Student ID</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. demo-account-002"
                                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500"
                                value={formData.studentId}
                                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                            />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Admin Username / Email</label>
                            <input
                                type="email"
                                required
                                placeholder="admin@nsrimpulse.com"
                                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                            <label className="block text-xs text-gray-400 uppercase tracking-wider mt-3 mb-1">Admin Security Passcode</label>
                            <input
                                type="password"
                                required
                                placeholder="Secret registration code"
                                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500"
                                value={formData.adminSecretKey}
                                onChange={(e) => setFormData({ ...formData, adminSecretKey: e.target.value })}
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Full Name</label>
                        <input
                            type="text"
                            required
                            placeholder="John Doe"
                            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Password</label>
                        <input
                            type="password"
                            required
                            placeholder="••••••••"
                            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl transition-all shadow-lg shadow-amber-500/20 mt-2"
                    >
                        Register Account
                    </button>
                </form>
            </div>
        </div>
    );
}