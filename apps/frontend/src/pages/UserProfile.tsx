import { useState, useEffect, useRef, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import {
    Loader2,
    User,
    Mail,
    Shield,
    Link as LinkIcon,
    Globe,
    Github,
    Apple,
    Camera,
    Upload,
    X,
    Check,
    ZoomIn,
    ZoomOut,
    Crop,
    KeyRound,
} from 'lucide-react';
import {
    getMe,
    getUserIdentities,
    linkIdentity,
    getSsoOptions,
    updateProfile,
    uploadAvatar,
    changePassword,
} from '@/api';
import { useSchool } from '@/context/SchoolContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface Identity {
    provider: string;
    createdAt: string;
}

// Predefined avatar options
const PREDEFINED_AVATARS = [
    { id: 'fox', emoji: '🦊', bg: 'from-orange-400 to-amber-500' },
    { id: 'cat', emoji: '🐱', bg: 'from-pink-400 to-rose-500' },
    { id: 'bear', emoji: '🐻', bg: 'from-amber-500 to-yellow-600' },
    { id: 'rabbit', emoji: '🐰', bg: 'from-emerald-400 to-teal-500' },
    { id: 'owl', emoji: '🦉', bg: 'from-blue-400 to-indigo-500' },
    { id: 'robot', emoji: '🤖', bg: 'from-cyan-400 to-blue-500' },
    { id: 'astronaut', emoji: '🧑‍🚀', bg: 'from-violet-400 to-purple-500' },
    { id: 'panda', emoji: '🐼', bg: 'from-green-400 to-emerald-500' },
    { id: 'unicorn', emoji: '🦄', bg: 'from-fuchsia-400 to-pink-500' },
    { id: 'dragon', emoji: '🐉', bg: 'from-red-400 to-orange-500' },
    { id: 'penguin', emoji: '🐧', bg: 'from-slate-400 to-slate-600' },
    { id: 'butterfly', emoji: '🦋', bg: 'from-sky-400 to-blue-500' },
];

function getAvatarMeta(avatarUrl: string | null | undefined) {
    if (!avatarUrl) return null;
    if (avatarUrl.startsWith('emoji:')) {
        const id = avatarUrl.replace('emoji:', '');
        return PREDEFINED_AVATARS.find((a) => a.id === id) || null;
    }
    return null;
}

// ─── Canvas crop utility ──────────────────────────────
function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => reject(error));
        image.setAttribute('crossOrigin', 'anonymous');
        image.src = url;
    });
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area, outputSize = 256): Promise<Blob> {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    canvas.width = outputSize;
    canvas.height = outputSize;

    ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, outputSize, outputSize);

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) return reject(new Error('Canvas is empty'));
                resolve(blob);
            },
            'image/jpeg',
            0.92,
        );
    });
}

export function UserProfile() {
    const { t } = useTranslation();
    const { role, isSystemAdmin, tokenType } = useSchool();
    const [user, setUser] = useState<any>(null);
    const [identities, setIdentities] = useState<Identity[]>([]);
    const [activeSsoOptions, setActiveSsoOptions] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ─── Change Password state ─────────────────────────
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    // ─── Cropper state ───────────────────────────────
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [userData, userIdentities, ssoOptions] = await Promise.all([
                    getMe(),
                    getUserIdentities(),
                    getSsoOptions(),
                ]);
                setUser(userData);
                setIdentities(userIdentities);
                setActiveSsoOptions(ssoOptions);
            } catch (err) {
                toast.error(t('profile.load_failed'));
            } finally {
                setLoading(false);
            }
        };
        fetchData();

        const params = new URLSearchParams(window.location.search);
        if (params.get('linked') === 'success') {
            toast.success(t('profile.linked_success'));
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSelectAvatar = async (avatarId: string) => {
        try {
            const avatarUrl = `emoji:${avatarId}`;
            const updated = await updateProfile({ avatarUrl });
            setUser(updated);
            setAvatarPickerOpen(false);
            toast.success(t('profile.avatar_set'));
        } catch {
            toast.error(t('profile.avatar_set_failed'));
        }
    };

    // When user picks a file, show the cropper instead of uploading immediately
    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            toast.error(t('profile.file_too_large'));
            return;
        }

        const reader = new FileReader();
        reader.addEventListener('load', () => {
            setImageSrc(reader.result as string);
            setCrop({ x: 0, y: 0 });
            setZoom(1);
        });
        reader.readAsDataURL(file);

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // When user confirms the crop, produce the final image and upload
    const handleCropConfirm = async () => {
        if (!imageSrc || !croppedAreaPixels) return;

        setUploading(true);
        try {
            const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, 256);
            const croppedFile = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' });

            const updated = await uploadAvatar(croppedFile);
            setUser(updated);
            setImageSrc(null);
            setAvatarPickerOpen(false);
            toast.success(t('profile.avatar_uploaded'));
        } catch (err: any) {
            toast.error(err.response?.data?.message || t('profile.avatar_upload_failed'));
        } finally {
            setUploading(false);
        }
    };

    const handleCropCancel = () => {
        setImageSrc(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
    };

    const handleRemoveAvatar = async () => {
        try {
            const updated = await updateProfile({ avatarUrl: undefined });
            setUser(updated);
            toast.success(t('profile.avatar_removed'));
        } catch {
            toast.error(t('profile.avatar_remove_failed'));
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmNewPassword) {
            toast.error(t('profile.passwords_mismatch'));
            return;
        }

        setChangingPassword(true);
        try {
            await changePassword({ oldPassword: currentPassword, newPassword });
            toast.success(t('profile.password_changed_success'));
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (err: any) {
            toast.error(err.response?.data?.message || t('profile.password_change_failed'));
        } finally {
            setChangingPassword(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const avatarMeta = getAvatarMeta(user?.avatarUrl);
    const hasCustomImage = user?.avatarUrl && user.avatarUrl.startsWith('data:');

    const allProviders = [
        { id: 'google', name: 'Google', icon: Globe, color: 'text-blue-500' },
        { id: 'github', name: 'GitHub', icon: Github, color: 'text-slate-900' },
        { id: 'microsoft', name: 'Microsoft', icon: Mail, color: 'text-blue-600' },
        { id: 'apple', name: 'Apple', icon: Apple, color: 'text-black' },
    ];

    const providers = allProviders.filter(
        (p) => identities.some((id) => id.provider.toLowerCase() === p.id) || activeSsoOptions.includes(p.id),
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6 py-8">
            <h1 className="text-3xl font-bold tracking-tight">{t('profile.title')}</h1>

            <div className="grid gap-6 md:grid-cols-3">
                {/* ──── Profile Card with Avatar ──── */}
                <Card className="md:col-span-1">
                    <CardHeader className="text-center">
                        <div className="relative mx-auto group">
                            <div
                                className={cn(
                                    'w-24 h-24 rounded-full flex items-center justify-center mb-4 overflow-hidden transition-all',
                                    'ring-2 ring-offset-2 ring-primary/20',
                                    avatarMeta
                                        ? `bg-gradient-to-br ${avatarMeta.bg}`
                                        : hasCustomImage
                                          ? ''
                                          : 'bg-primary/10',
                                )}
                            >
                                {avatarMeta ? (
                                    <span className="text-4xl">{avatarMeta.emoji}</span>
                                ) : hasCustomImage ? (
                                    <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-12 h-12 text-primary" />
                                )}
                            </div>
                            <button
                                onClick={() => setAvatarPickerOpen(!avatarPickerOpen)}
                                className="absolute bottom-3 right-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md hover:bg-primary/90 transition-all hover:scale-110"
                                title={t('profile.change_avatar')}
                            >
                                <Camera className="w-4 h-4" />
                            </button>
                        </div>
                        <CardTitle>
                            {user?.firstName} {user?.lastName}
                        </CardTitle>
                        <CardDescription>{user?.email}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-2 text-sm">
                            <Shield className="w-4 h-4 text-muted-foreground" />
                            <span>
                                {t('common.role')}:{' '}
                                {tokenType === 'GLOBAL' && isSystemAdmin
                                    ? t('roles.SYSTEM_ADMIN')
                                    : role
                                      ? t(`roles.${role}`, { defaultValue: role })
                                      : t('profile.user_role')}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <span>{user?.email}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* ──── Avatar Picker / Cropper / SSO ──── */}
                <div className="md:col-span-2 space-y-6">
                    {/* ══════ Image Cropper Modal ══════ */}
                    {imageSrc && (
                        <Card className="animate-in slide-in-from-top-2 fade-in duration-300 overflow-hidden">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Crop className="w-4 h-4 text-primary" />
                                        {t('profile.crop_title')}
                                    </CardTitle>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCropCancel}>
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                                <CardDescription>{t('profile.crop_description')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Cropper Area */}
                                <div className="relative w-full h-72 bg-black/5 rounded-lg overflow-hidden">
                                    <Cropper
                                        image={imageSrc}
                                        crop={crop}
                                        zoom={zoom}
                                        aspect={1}
                                        cropShape="round"
                                        showGrid={false}
                                        onCropChange={setCrop}
                                        onZoomChange={setZoom}
                                        onCropComplete={onCropComplete}
                                    />
                                </div>

                                {/* Zoom Control */}
                                <div className="flex items-center gap-3 px-2">
                                    <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <input
                                        type="range"
                                        min={1}
                                        max={3}
                                        step={0.05}
                                        value={zoom}
                                        onChange={(e) => setZoom(Number(e.target.value))}
                                        className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary
                                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md
                                            [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform
                                            [&::-webkit-slider-thumb]:hover:scale-125"
                                    />
                                    <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <span className="text-xs text-muted-foreground w-10 text-right">
                                        {Math.round(zoom * 100)}%
                                    </span>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex justify-end gap-2 pt-2">
                                    <Button variant="outline" size="sm" onClick={handleCropCancel}>
                                        {t('common.cancel')}
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleCropConfirm}
                                        disabled={uploading}
                                        className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                                    >
                                        {uploading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Check className="w-4 h-4" />
                                        )}
                                        {uploading ? t('profile.uploading') : t('profile.save_crop')}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* ══════ Avatar Picker Panel ══════ */}
                    {avatarPickerOpen && !imageSrc && (
                        <Card className="animate-in slide-in-from-top-2 fade-in duration-300">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Camera className="w-4 h-4 text-primary" />
                                        {t('profile.change_avatar')}
                                    </CardTitle>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setAvatarPickerOpen(false)}
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                                <CardDescription>{t('profile.avatar_picker_description')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Predefined Avatars Grid */}
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                                        {t('profile.predefined_avatars')}
                                    </p>
                                    <div className="grid grid-cols-6 gap-3">
                                        {PREDEFINED_AVATARS.map((a) => {
                                            const isSelected = user?.avatarUrl === `emoji:${a.id}`;
                                            return (
                                                <button
                                                    key={a.id}
                                                    onClick={() => handleSelectAvatar(a.id)}
                                                    className={cn(
                                                        'relative w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110',
                                                        `bg-gradient-to-br ${a.bg}`,
                                                        isSelected && 'ring-2 ring-primary ring-offset-2',
                                                        'shadow-md hover:shadow-lg',
                                                    )}
                                                    title={a.id}
                                                >
                                                    <span className="text-2xl">{a.emoji}</span>
                                                    {isSelected && (
                                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center">
                                                            <Check className="w-3 h-3" />
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Upload Section */}
                                <div className="border-t pt-4">
                                    <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                                        {t('profile.custom_image')}
                                    </p>
                                    <div className="flex gap-3">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/gif"
                                            className="hidden"
                                            onChange={handleFileSelected}
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploading}
                                            className="gap-2"
                                        >
                                            <Upload className="w-4 h-4" />
                                            {t('profile.upload_image')}
                                        </Button>
                                        {user?.avatarUrl && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleRemoveAvatar}
                                                className="text-destructive hover:text-destructive gap-2"
                                            >
                                                <X className="w-4 h-4" />
                                                {t('profile.remove_avatar')}
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-2">{t('profile.upload_hint')}</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* ══════ Change Password Card ══════ */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <KeyRound className="w-5 h-5 text-primary" />
                                {t('profile.security_title')}
                            </CardTitle>
                            <CardDescription>{t('profile.security_description')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleChangePassword} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="currentPassword">{t('profile.current_password')}</Label>
                                    <PasswordInput
                                        id="currentPassword"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="newPassword">{t('profile.new_password')}</Label>
                                        <PasswordInput
                                            id="newPassword"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirmNewPassword">{t('profile.confirm_new_password')}</Label>
                                        <PasswordInput
                                            id="confirmNewPassword"
                                            value={confirmNewPassword}
                                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <Button type="submit" disabled={changingPassword} className="gap-2">
                                        {changingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {t('profile.change_password_button')}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* ══════ SSO Card ══════ */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <LinkIcon className="w-5 h-5 text-primary" />
                                {t('profile.sso_title')}
                            </CardTitle>
                            <CardDescription>{t('profile.sso_description')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {providers.map((p) => {
                                const linked = identities.find((id) => id.provider.toLowerCase() === p.id);
                                return (
                                    <div
                                        key={p.id}
                                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <p.icon className={`w-5 h-5 ${p.color}`} />
                                            <div>
                                                <p className="font-medium">{p.name}</p>
                                                {linked ? (
                                                    <p className="text-xs text-muted-foreground">
                                                        {t('profile.linked_at')}{' '}
                                                        {new Date(linked.createdAt).toLocaleDateString()}
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-muted-foreground italic">
                                                        {t('profile.not_linked')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {linked ? (
                                            <Badge
                                                variant="outline"
                                                className="bg-emerald-50 text-emerald-700 border-emerald-200"
                                            >
                                                {t('profile.active')}
                                            </Badge>
                                        ) : (
                                            <Button variant="outline" size="sm" onClick={() => linkIdentity(p.id)}>
                                                {t('profile.link_account')}
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
