import React, { useEffect, useState } from 'react';
import { getClassrooms } from '../api';

export const Registry: React.FC = () => {
    const [classrooms, setClassrooms] = useState<any[]>([]);

    useEffect(() => {
        getClassrooms().then(setClassrooms).catch(console.error);
    }, []);

    return (
        <div>
            <h1>Registry (Matrika)</h1>
            <p>Manage users, classrooms, and profiles.</p>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {classrooms.map((c) => (
                    <div key={c.id} style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}>
                        <h3>{c.name} (Grade {c.grade})</h3>
                        <p>Students: {c.students?.length || 0}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
