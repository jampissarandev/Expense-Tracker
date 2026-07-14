import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2Icon } from "lucide-react"

import { useAuth } from "@/features/auth/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

// ── Schema ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.email("กรุณากรอกอีเมลที่ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
})

type LoginFormValues = z.infer<typeof loginSchema>

// ── Component ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function handleAuth(values: LoginFormValues) {
    try {
      setIsSubmitting(true)
      await login(values.email, values.password)
      toast.success("เข้าสู่ระบบสำเร็จ")
      setTimeout(() => navigate("/"), 1500)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่"
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">เข้าสู่ระบบ</CardTitle>
          <CardDescription>ลงชื่อเข้าใช้บัญชีของคุณ</CardDescription>
        </CardHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleAuth)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>อีเมล (Email)</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="name@example.com"
                        autoComplete="email"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>รหัสผ่าน (Password)</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2Icon className="mr-2 size-4 animate-spin" />
                    กำลังเข้าสู่ระบบ…
                  </>
                ) : (
                  "เข้าสู่ระบบ"
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                ยังไม่มีบัญชี?{" "}
                <Link to="/register" className="text-primary underline-offset-4 hover:underline">
                  สมัครสมาชิก
                </Link>
              </p>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}
