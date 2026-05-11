"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode, Download, Copy, Check, RefreshCw } from "lucide-react";

interface QRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
}

export function QRDialog({ open, onOpenChange, slug }: QRDialogProps) {
  const [size, setSize] = useState(200);
  const [copied, setCopied] = useState(false);
  const shortUrl = `https://short.ly/${slug}`;
  const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(shortUrl)}&bgcolor=1a1a1a&color=ffffff`;

  const downloadQR = () => {
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `qr-${slug}.png`;
    link.click();
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            QR Code
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-center p-6 bg-secondary/50 rounded-xl">
            <img 
              src={qrDataUrl} 
              alt={`QR Code for ${slug}`}
              className="rounded-lg shadow-lg"
              style={{ width: size, height: size }}
            />
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-secondary/30 rounded-lg">
            <Input 
              value={shortUrl} 
              readOnly 
              className="bg-transparent border-0 text-sm text-foreground"
            />
            <Button variant="ghost" size="icon" onClick={copyToClipboard}>
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Size</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="100"
                  max="500"
                  value={size}
                  onChange={(e) => setSize(parseInt(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <span className="text-sm text-muted-foreground w-12">{size}px</span>
              </div>
            </div>
          </div>

          <Button 
            onClick={downloadQR}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Download className="w-4 h-4 mr-2" />
            Download QR Code
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}