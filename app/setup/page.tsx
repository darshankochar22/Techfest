"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, FileText, Briefcase, ArrowRight, Home } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function SetupPage() {
  const router = useRouter()
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [jobDescFile, setJobDescFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.txt')) {
        setError('Resume must be a .txt file')
        return
      }
      setResumeFile(file)
      setError(null)
    }
  }

  const handleJobDescChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.txt')) {
        setError('Job description must be a .txt file')
        return
      }
      setJobDescFile(file)
      setError(null)
    }
  }

  const handleStartInterview = async () => {
    if (!resumeFile && !jobDescFile) {
      setError('Please upload at least one file (resume or job description)')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const formData = new FormData()
      formData.append('session_id', sessionId)
      
      if (resumeFile) {
        formData.append('resume', resumeFile)
      }
      if (jobDescFile) {
        formData.append('job_description', jobDescFile)
      }

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const response = await fetch(`${backendUrl}/interview/upload-context`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to upload files')
      }

      // Store session ID in localStorage for the interview page
      localStorage.setItem('interviewSessionId', sessionId)
      
      // Navigate to interview page
      router.push('/interview')
    } catch (err) {
      setError('Failed to upload files. Please try again.')
      console.error(err)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSkipSetup = () => {
    router.push('/interview')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <nav className="w-full py-3 px-6 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-foreground text-xl font-semibold">Pointer</span>
            <span className="text-sm px-2 py-1 rounded bg-primary/10 text-primary">AI Interview</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <Home className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Setup Your Interview</CardTitle>
            <CardDescription>
              Upload your resume and job description (as .txt files) to help the AI ask relevant questions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Resume Upload */}
            <div className="space-y-2">
              <Label htmlFor="resume" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Resume (Optional)
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="resume"
                  type="file"
                  accept=".txt"
                  onChange={handleResumeChange}
                  className="flex-1"
                />
                {resumeFile && (
                  <span className="text-sm text-muted-foreground">
                    {resumeFile.name}
                  </span>
                )}
              </div>
            </div>

            {/* Job Description Upload */}
            <div className="space-y-2">
              <Label htmlFor="job-desc" className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Job Description (Optional)
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="job-desc"
                  type="file"
                  accept=".txt"
                  onChange={handleJobDescChange}
                  className="flex-1"
                />
                {jobDescFile && (
                  <span className="text-sm text-muted-foreground">
                    {jobDescFile.name}
                  </span>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Info Box */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm text-muted-foreground">
                <Upload className="w-4 h-4 inline mr-2" />
                Upload .txt files only. The AI will use this information to ask targeted interview questions
                based on your background and the job requirements.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleStartInterview}
                disabled={isUploading || (!resumeFile && !jobDescFile)}
                className="flex-1"
                size="lg"
              >
                {isUploading ? (
                  <>Uploading...</>
                ) : (
                  <>
                    Start Interview
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
              <Button
                onClick={handleSkipSetup}
                variant="outline"
                size="lg"
                disabled={isUploading}
              >
                Skip Setup
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
