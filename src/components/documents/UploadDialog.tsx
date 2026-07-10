'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, Link2, Sparkles } from 'lucide-react';

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
        <Button className="h-10 bg-gradient-to-r from-primary to-violet-600 text-primary-foreground font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-95 shadow-md shadow-primary/10 transition-all active:scale-[0.98]">
          <Upload className="h-4 w-4" />
          <span>Thêm tài liệu</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md glass-card border border-white/[0.08] bg-popover/95 backdrop-blur-2xl rounded-2xl shadow-2xl p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Sparkles className="h-5 w-5 text-accent animate-pulse" />
            <span>Thêm tài liệu RAG</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="file" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2 rounded-xl bg-white/5 border border-white/[0.06] p-1 mb-4 h-11">
            <TabsTrigger
              value="file"
              className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Tệp tin</span>
            </TabsTrigger>
            <TabsTrigger
              value="url"
              className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Link2 className="h-3.5 w-3.5" />
              <span>Đường dẫn (URL)</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="outline-none focus:outline-none">
            <form onSubmit={submitFile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file" className="text-xs font-semibold text-muted-foreground">
                  Chọn tệp (PDF, DOCX, TXT, MD — tối đa 20 MB)
                </Label>
                <div className="relative flex items-center">
                  <Input
                    id="file"
                    name="file"
                    type="file"
                    accept={ACCEPT}
                    required
                    className="w-full bg-white/[0.02] border-white/[0.08] focus:border-primary/50 focus:ring-primary/20 rounded-xl h-11 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/25 file:text-primary file:cursor-pointer hover:file:bg-primary/30"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title" className="text-xs font-semibold text-muted-foreground">
                  Tiêu đề hiển thị (tùy chọn)
                </Label>
                <Input
                  id="title"
                  name="title"
                  type="text"
                  placeholder="Ví dụ: Nghị định 100/2019"
                  className="bg-white/[0.02] border-white/[0.08] focus:border-primary/50 focus:ring-primary/20 rounded-xl h-11 text-sm text-foreground"
                />
              </div>

              <Button
                type="submit"
                disabled={busy}
                className="w-full h-11 mt-2 bg-gradient-to-r from-primary to-violet-600 text-primary-foreground font-semibold rounded-xl shadow-lg hover:opacity-95 transition-all"
              >
                {busy ? 'Đang tải lên...' : 'Tải lên tài liệu'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="url" className="outline-none focus:outline-none">
            <form onSubmit={submitUrl} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url" className="text-xs font-semibold text-muted-foreground">
                  Đường dẫn (URL) bài viết
                </Label>
                <Input
                  id="url"
                  name="url"
                  type="url"
                  placeholder="https://luatvietnam.vn/..."
                  required
                  className="bg-white/[0.02] border-white/[0.08] focus:border-primary/50 focus:ring-primary/20 rounded-xl h-11 text-sm text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="title" className="text-xs font-semibold text-muted-foreground">
                  Tiêu đề hiển thị
                </Label>
                <Input
                  id="title"
                  name="title"
                  type="text"
                  placeholder="Tiêu đề hiển thị của trang web"
                  required
                  className="bg-white/[0.02] border-white/[0.08] focus:border-primary/50 focus:ring-primary/20 rounded-xl h-11 text-sm text-foreground"
                />
              </div>

              <Button
                type="submit"
                disabled={busy}
                className="w-full h-11 mt-2 bg-gradient-to-r from-primary to-violet-600 text-primary-foreground font-semibold rounded-xl shadow-lg hover:opacity-95 transition-all"
              >
                {busy ? 'Đang xử lý...' : 'Nạp dữ liệu từ URL'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
