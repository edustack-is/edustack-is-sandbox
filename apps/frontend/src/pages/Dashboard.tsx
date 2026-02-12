import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';

export const Dashboard: React.FC = () => {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Nástěnka</h1>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Celkem studentů</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">120</div>
                        <p className="text-xs text-muted-foreground">+2 od minulého měsíce</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Aktivní třídy</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">8</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Učitelé</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">12</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Rychlý přehled</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Zde bude graf nebo seznam posledních aktivit.</p>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Nadcházející události</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Žádné události pro dnešek.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
