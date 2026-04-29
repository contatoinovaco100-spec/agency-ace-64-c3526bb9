CREATE TABLE IF NOT EXISTS public.client_scopes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    month DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(client_id, month)
);

CREATE TABLE IF NOT EXISTS public.client_scope_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    scope_id UUID NOT NULL REFERENCES public.client_scopes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Em andamento', 'Concluído')),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.client_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_scope_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for client_scopes
CREATE POLICY "Enable read access for all authenticated users" ON public.client_scopes
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON public.client_scopes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.client_scopes
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.client_scopes
    FOR DELETE USING (auth.role() = 'authenticated');

-- Create policies for client_scope_tasks
CREATE POLICY "Enable read access for all authenticated users" ON public.client_scope_tasks
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON public.client_scope_tasks
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.client_scope_tasks
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.client_scope_tasks
    FOR DELETE USING (auth.role() = 'authenticated');
