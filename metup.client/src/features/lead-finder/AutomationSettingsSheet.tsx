import { useState, type FormEvent } from "react"
import { Check, Copy, KeyRound, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Alert, Skeleton } from "@/components/ui/states"
import { toFieldErrors, toMessage } from "@/features/companies/form-errors"
import { useAsyncResource } from "@/lib/hooks"
import { getLeadFinderSettings, rotateServiceToken, updateLeadFinderSettings } from "./api"

/**
 * A costura com o n8n (seção 5 do CLAUDE.md): o webhook que recebe os pedidos de busca e o token
 * que a automação usa para devolver os resultados. Segredos de mapas/IA continuam só no n8n.
 */
export function AutomationSettingsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [webhookUrl, setWebhookUrl] = useState("")
  const settings = useAsyncResource((signal) => getLeadFinderSettings(signal), [], {
    enabled: open,
    // Recarga em segundo plano não atropela o que a pessoa está digitando.
    onSuccess: (data, { silent }) => {
      if (!silent) setWebhookUrl(data.webhookUrl ?? "")
    },
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [copied, setCopied] = useState(false)

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      settings.setData(await updateLeadFinderSettings(webhookUrl.trim() || null))
      setSaved(true)
    } catch (err) {
      setError(toFieldErrors(err).webhookUrl ?? toMessage(err, "Não foi possível salvar."))
    } finally {
      setSaving(false)
    }
  }

  async function rotate() {
    setRotating(true)
    setError(null)
    try {
      setToken((await rotateServiceToken()).token)
      setConfirmRotate(false)
      settings.reload({ silent: true })
    } catch (err) {
      setError(toMessage(err, "Não foi possível gerar o token."))
    } finally {
      setRotating(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="md">
        <SheetHeader>
          <SheetTitle>Conexão com a automação</SheetTitle>
          <SheetDescription>
            O CRM pede a busca ao n8n pelo webhook; o n8n garimpa e devolve os leads pela API do CRM.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="gap-8 px-5 py-6 sm:px-6">
          {settings.isLoading && !settings.data ? (
            <div className="flex flex-col gap-3" role="status">
              <span className="sr-only">Carregando…</span>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : settings.error ? (
            <Alert onRetry={() => settings.reload()}>Não foi possível carregar a conexão.</Alert>
          ) : (
            <>
              <form onSubmit={save} className="flex flex-col gap-3" noValidate>
                <Label htmlFor="webhook-url">Webhook do n8n</Label>
                <Input
                  id="webhook-url"
                  type="url"
                  inputMode="url"
                  value={webhookUrl}
                  onChange={(e) => {
                    setWebhookUrl(e.target.value)
                    setSaved(false)
                  }}
                  placeholder="https://seu-n8n/webhook/buscar-leads"
                  spellCheck={false}
                  aria-describedby="webhook-hint"
                />
                <p id="webhook-hint" className="text-xs text-muted">
                  Recebe <code className="font-mono">lead_search.requested</code> assim que alguém pede uma busca. Vazio: os pedidos
                  ficam na fila de eventos para o n8n consultar.
                </p>
                <div className="flex items-center gap-3">
                  <Button type="submit" size="sm" disabled={saving}>
                    {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                    Salvar
                  </Button>
                  {saved && (
                    <span role="status" className="inline-flex items-center gap-1.5 text-sm text-success">
                      <Check className="size-4" aria-hidden="true" />
                      Salvo
                    </span>
                  )}
                </div>
              </form>

              <section aria-labelledby="token-title" className="flex flex-col gap-3 border-t border-line-soft pt-6">
                <h3 id="token-title" className="label-mono text-fg-muted">
                  Token de integração
                </h3>
                <p className="text-sm text-fg-muted">
                  {settings.data?.serviceTokenConfigured
                    ? "Já existe um token — o mesmo usado pelas outras automações (WhatsApp, Meta Ads). O n8n o envia no cabeçalho X-Service-Token."
                    : "Ainda não há token. Gere um e cole na credencial do n8n (cabeçalho X-Service-Token)."}
                </p>

                {token ? (
                  <div className="flex flex-col gap-2">
                    <Alert tone="success">Copie agora — ele não aparece de novo.</Alert>
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate rounded-xs bg-surface-2 px-3 py-2 font-mono text-xs text-fg">{token}</code>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label="Copiar token"
                        onClick={() => {
                          void navigator.clipboard?.writeText(token).then(() => setCopied(true))
                        }}
                      >
                        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                      </Button>
                    </div>
                  </div>
                ) : confirmRotate ? (
                  <div className="flex flex-col gap-3 rounded-xs border border-danger/40 bg-danger/5 p-3">
                    <p className="text-sm text-fg">
                      O token atual para de valer na hora: toda automação que usa ele precisa receber o novo.
                    </p>
                    <div className="flex justify-end gap-2">
                      <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmRotate(false)}>
                        Voltar
                      </Button>
                      <Button type="button" size="sm" variant="destructive" disabled={rotating} onClick={rotate}>
                        {rotating && <Loader2 className="animate-spin" aria-hidden="true" />}
                        Gerar novo token
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-fit"
                    onClick={() => (settings.data?.serviceTokenConfigured ? setConfirmRotate(true) : void rotate())}
                  >
                    <KeyRound aria-hidden="true" />
                    {settings.data?.serviceTokenConfigured ? "Gerar novo token" : "Gerar token"}
                  </Button>
                )}
              </section>

              {error && (
                <p role="alert" className="text-sm font-medium text-danger">
                  {error}
                </p>
              )}
            </>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
