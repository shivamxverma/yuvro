import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from './ui/input';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from './ui/select';
import { Button } from './ui/button';

const SLUG_WORKS = ["car", "dog", "computer", "person", "inside", "word", "for", "please", "to", "cool", "open", "source"];

function getRandomSlug() {
    let slug = "";
    for (let i = 0; i < 3; i++) {
        slug += SLUG_WORKS[Math.floor(Math.random() * SLUG_WORKS.length)];
    }
    return slug;
}

export const LandingPage = () => {
    const [language, setLanguage] = useState("python");
    const [replId, setReplId] = useState(getRandomSlug());
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleCreateProject = async () => {
        if (!replId.trim()) {
            alert("Repl Id cannot be empty");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch("http://localhost:3001/project", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    replId: replId,
                    language: language,
                }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "Failed to create project");
            }

            
            navigate(`/coding/?replId=${replId}`);
        } catch (error: any) {
            alert(error.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
            <h1 className="text-4xl font-bold">Yuvro</h1>
            <div className="flex flex-col gap-2 w-full max-w-sm">
                <Input
                    onChange={(e) => setReplId(e.target.value)}
                    type="text"
                    placeholder="Repl Id"
                    value={replId}
                    disabled={loading}
                />
                <Select value={language} onValueChange={setLanguage} disabled={loading}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a Framework" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Framework</SelectLabel>
                            <SelectItem value="python">Python</SelectItem>
                            <SelectItem value="fastapi">FastAPI</SelectItem>
                            <SelectItem value="django">Django</SelectItem>
                            <SelectItem value="flask">Flask</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
                <Button type="button" onClick={handleCreateProject} disabled={loading}>
                    {loading ? "Creating..." : "Create Project"}
                </Button>
            </div>
        </div>
    )
}