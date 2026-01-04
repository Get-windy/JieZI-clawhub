import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: { component: unknown }) => config,
  useNavigate: () => vi.fn(),
}))
import { Upload } from './upload'

const generateUploadUrl = vi.fn()
const publishVersion = vi.fn()
const fetchMock = vi.fn()

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useMutation: () => generateUploadUrl,
  useAction: () => publishVersion,
  useQuery: () => null,
}))

describe('Upload route', () => {
  beforeEach(() => {
    generateUploadUrl.mockReset()
    publishVersion.mockReset()
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ storageId: 'storage-id' }),
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('hides validation issues until submit', async () => {
    render(<Upload />)
    const publishButton = screen.getByRole('button', { name: /publish/i })
    expect(publishButton).toBeTruthy()
    expect(screen.queryByText(/Slug is required/i)).toBeNull()
    fireEvent.click(publishButton)
    await waitFor(() => {
      expect(screen.getByText(/Slug is required/i)).toBeTruthy()
    })
    expect(screen.getByText(/Display name is required/i)).toBeTruthy()
  })

  it('marks the input for folder uploads', async () => {
    render(<Upload />)
    const input = screen.getByTestId('upload-input')
    await waitFor(() => {
      expect(input.getAttribute('webkitdirectory')).not.toBeNull()
    })
  })

  it('enables publish when fields and files are valid, and allows removing files', async () => {
    generateUploadUrl.mockResolvedValue('https://upload.local')
    render(<Upload />)
    fireEvent.change(screen.getByPlaceholderText('my-skill-pack'), {
      target: { value: 'cool-skill' },
    })
    fireEvent.change(screen.getByPlaceholderText('My Skill Pack'), {
      target: { value: 'Cool Skill' },
    })
    fireEvent.change(screen.getByPlaceholderText('1.0.0'), {
      target: { value: '1.2.3' },
    })
    fireEvent.change(screen.getByPlaceholderText('latest, beta'), {
      target: { value: 'latest' },
    })
    const file = new File(['hello'], 'SKILL.md', { type: 'text/markdown' })
    const input = screen.getByTestId('upload-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    const publishButton = screen.getByRole('button', { name: /publish/i }) as HTMLButtonElement
    expect(await screen.findByText(/Ready to publish/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /remove/i }))
    expect(screen.queryByText(/Add at least one file/i)).toBeNull()
    fireEvent.click(publishButton)
    expect(await screen.findByText(/Add at least one file/i)).toBeTruthy()
  })

  it('surfaces publish errors and stays on page', async () => {
    publishVersion.mockRejectedValueOnce(new Error('Changelog is required'))
    generateUploadUrl.mockResolvedValue('https://upload.local')
    render(<Upload />)
    fireEvent.change(screen.getByPlaceholderText('my-skill-pack'), {
      target: { value: 'cool-skill' },
    })
    fireEvent.change(screen.getByPlaceholderText('My Skill Pack'), {
      target: { value: 'Cool Skill' },
    })
    fireEvent.change(screen.getByPlaceholderText('1.0.0'), {
      target: { value: '1.2.3' },
    })
    fireEvent.change(screen.getByPlaceholderText('latest, beta'), {
      target: { value: 'latest' },
    })
    fireEvent.change(screen.getByPlaceholderText('What changed in this version?'), {
      target: { value: 'Initial drop.' },
    })
    const file = new File(['hello'], 'SKILL.md', { type: 'text/markdown' })
    const input = screen.getByTestId('upload-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    const publishButton = screen.getByRole('button', { name: /publish/i }) as HTMLButtonElement
    await screen.findByText(/Ready to publish/i)
    fireEvent.click(publishButton)
    expect(await screen.findByText(/Changelog is required/i)).toBeTruthy()
  })
})
