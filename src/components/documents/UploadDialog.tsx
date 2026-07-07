'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload } from 'lucide-react';

const ACCEPT = '.pdf,.docx,.txt,.md';

export function UploadDialog({ onUploaded }: { onUploaded: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submitFile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem('file') as HTMLInputElement;
    const titleInput = form.elements.namedItem('title') as HTMLInputElement;
    if (!fileInput.files?.[0]) return toast.error('Chọn tệp trước');

    const fd = new FormData();
    fd.append('file', fileInput.files[0]);
    fd.append('title', titleInput.value || fileInput.files[0].name);
    setBusy(true);
    const res = await fetch('/api/documents', { method: 'POST', body: fd });
    setBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error ?? 'Upload thất bại');
    }
    toast.success('Đã bắt đầu xử lý');
    setOpen(false);
    onUploaded();
  }

  async function submitUrl(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const urlInput = form.elements.namedItem('url') as HTMLInputElement;
    const titleInput = form.elements.namedItem('title') as HTMLInputElement;
    setBusy(true);
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: urlInput.value, title: titleInput.value }),
    });
    setBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error ?? 'Thất bại');
    }
    toast.success('Đã bắt đầu xử lý');
    setOpen(false);
    onUploaded();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-2 h-4 w-4" /> Thêm tài liệu
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm tài liệu</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="file">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file">Tệp</TabsTrigger>
            <TabsTrigger value="url">URL</TabsTrigger>
          </TabsList>
          <TabsContent value="file">
            <form onSubmit={submitFile} className="space-y-3">
              <div>
                <Label htmlFor="file">Chọn tệp (PDF, DOCX, TXT, MD — tối đa 20 MB)</Label>
                <Input id="file" name="file" type="file" accept={ACCEPT} required />
              </div>
              <div>
                <Label htmlFor="title">Tiêu đề (tùy chọn)</Label>
                <Input id="title" name="title" type="text" placeholder="Ví dụ: Nghị định 100/2019" />
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Đang tải lên…' : 'Tải lên'}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="url">
            <form onSubmit={submitUrl} className="space-y-3">
              <div>
                <Label htmlFor="url">URL bài viết</Label>
                <Input id="url" name="url" type="url" placeholder="https://…" required />
              </div>
              <div>
                <Label htmlFor="title">Tiêu đề</Label>
                <Input id="title" name="title" type="text" placeholder="Tiêu đề hiển thị" required />
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Đang xử lý…' : 'Nạp URL'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
