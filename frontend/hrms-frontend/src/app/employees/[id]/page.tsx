import { Suspense } from 'react'
import { EmployeeProfilePage } from "@/modules/employees/pages/EmployeeProfilePage"

export default function EmployeeRoute() {
  return (
    <Suspense fallback={null}>
      <EmployeeProfilePage />
    </Suspense>
  )
}
