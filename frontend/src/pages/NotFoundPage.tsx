import { Link } from "react-router-dom"
import { HomeIcon, FileQuestionIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

/**
 * 404 page displayed when no route matches the current URL.
 * Provides a link back to the dashboard.
 */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="mx-auto max-w-md text-center">
        <CardContent className="pt-8">
          <FileQuestionIcon className="text-muted-foreground mx-auto mb-4 size-16" />
          <h1 className="mb-2 text-4xl font-bold">404</h1>
          <p className="text-muted-foreground mb-6 text-lg">
            ไม่พบหน้าที่คุณกำลังมองหา
          </p>
          <p className="text-muted-foreground mb-8 text-sm">
            หน้าที่คุณต้องการอาจถูกลบ เปลี่ยนชื่อ หรือไม่มีอยู่ในระบบ
          </p>
          <Link to="/">
            <Button>
              <HomeIcon className="mr-2 size-4" />
              กลับไปหน้าแรก
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
