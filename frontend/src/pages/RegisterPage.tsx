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

const registerSchema = z.object({
  displayName: z.string().min(1, "กรุณากรอกชื่อที่แสดง"),
  email: z.email("กรุณากรอกอีเมลที่ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
})

type RegisterFormValues = z.infer<typeof registerSchema>

// ── Component ────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  })

  async function handleAuth(values: RegisterFormValues) {
    try {
      setIsSubmitting(true)
      await register(values.email, values.password, values.displayName)
      toast.success("สมัครสมาชิกสำเร็จ")
      setTimeout(() => navigate("/"), 1500)
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("409")
      ) {
        toast.error("อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่น")
      } else {
        const message =
          err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่"
        toast.error(message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">สมัครสมาชิก</CardTitle>
          <CardDescription>สร้างบัญชีใหม่</CardDescription>
        </CardHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleAuth)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ชื่อที่แสดง (Display Name)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="ชื่อของคุณ"
                        autoComplete="name"
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
                        autoComplete="new-password"
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
                    กำลังสมัครสมาชิก…
                  </>
                ) : (
                  "สมัครสมาชิก"
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                มีบัญชีอยู่แล้ว?{" "}
                <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                  เข้าสู่ระบบ
                </Link>
              </p>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}
