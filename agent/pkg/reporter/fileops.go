package reporter

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
)

// HandleFileOps 处理文件操作消息，返回响应消息
func HandleFileOps(msg WSMessage) *WSMessage {
	switch msg.Type {
	case "file-list":
		return handleFileList(msg.Data)
	case "file-read":
		return handleFileRead(msg.Data, msg.Offset, msg.Length)
	case "file-write":
		return handleFileWrite(msg.Data, msg.Offset, msg.Path)
	case "file-delete":
		return handleFileDelete(msg.Data)
	case "file-mkdir":
		return handleFileMkdir(msg.Data)
	case "file-rmdir":
		return handleFileRmdir(msg.Data)
	case "file-rename":
		return handleFileRename(msg.Data, msg.Path)
	}
	return nil
}

type FileEntry struct {
	Name    string `json:"name"`
	Size    int64  `json:"size"`
	Mode    string `json:"mode"`
	ModTime string `json:"modTime"`
	IsDir   bool   `json:"isDir"`
}

type FileListResult struct {
	Path    string      `json:"path"`
	Entries []FileEntry `json:"entries"`
}

func handleFileList(path string) *WSMessage {
	if path == "" {
		path = "/"
	}

	entries, err := ioutil.ReadDir(path)
	if err != nil {
		return &WSMessage{Type: "file-error", Data: fmt.Sprintf("list failed: %v", err)}
	}

	result := FileListResult{Path: path}
	for _, e := range entries {
		result.Entries = append(result.Entries, FileEntry{
			Name:    e.Name(),
			Size:    e.Size(),
			Mode:    e.Mode().String(),
			ModTime: e.ModTime().Format("2006-01-02 15:04:05"),
			IsDir:   e.IsDir(),
		})
	}

	data, _ := json.Marshal(result)
	return &WSMessage{Type: "file-list-result", Data: string(data)}
}

func handleFileRead(path string, offset int, length int) *WSMessage {
	if path == "" {
		return &WSMessage{Type: "file-error", Data: "read failed: no path"}
	}

	data, err := ioutil.ReadFile(path)
	if err != nil {
		return &WSMessage{Type: "file-error", Data: fmt.Sprintf("read failed: %v", err)}
	}

	// Handle offset and length
	start := offset
	if start < 0 {
		start = 0
	}
	end := start + length
	if length <= 0 || end > len(data) {
		end = len(data)
	}
	if start > len(data) {
		start = len(data)
	}

	chunk := data[start:end]
	encoded := base64.StdEncoding.EncodeToString(chunk)

	return &WSMessage{
		Type:   "file-read-result",
		Data:   encoded,
		Path:   path,
		Offset: start,
		Length: len(chunk),
	}
}

func handleFileWrite(path string, offset int, data string) *WSMessage {
	if path == "" {
		return &WSMessage{Type: "file-error", Data: "write failed: no path"}
	}

	decoded, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return &WSMessage{Type: "file-error", Data: fmt.Sprintf("write decode failed: %v", err)}
	}

	// Create parent directory if needed
	dir := filepath.Dir(path)
	if dir != "." {
		os.MkdirAll(dir, 0755)
	}

	if offset > 0 {
		// Append mode - read existing, merge, write
		existing, err := ioutil.ReadFile(path)
		if err == nil {
			if offset+len(decoded) > len(existing) {
				// Extend file
				newData := make([]byte, offset+len(decoded))
				copy(newData, existing)
				copy(newData[offset:], decoded)
				err = ioutil.WriteFile(path, newData, 0644)
			} else {
				// Overwrite portion
				copy(existing[offset:], decoded)
				err = ioutil.WriteFile(path, existing, 0644)
			}
		} else {
			err = ioutil.WriteFile(path, decoded, 0644)
		}
		if err != nil {
			return &WSMessage{Type: "file-error", Data: fmt.Sprintf("write failed: %v", err)}
		}
	} else {
		err = ioutil.WriteFile(path, decoded, 0644)
		if err != nil {
			return &WSMessage{Type: "file-error", Data: fmt.Sprintf("write failed: %v", err)}
		}
	}

	return &WSMessage{Type: "file-write-result", Data: path, Path: path, Offset: offset + len(decoded)}
}

func handleFileDelete(path string) *WSMessage {
	if path == "" {
		return &WSMessage{Type: "file-error", Data: "delete failed: no path"}
	}

	err := os.Remove(path)
	if err != nil {
		return &WSMessage{Type: "file-error", Data: fmt.Sprintf("delete failed: %v", err)}
	}

	return &WSMessage{Type: "file-delete-result", Data: path}
}

func handleFileMkdir(path string) *WSMessage {
	if path == "" {
		return &WSMessage{Type: "file-error", Data: "mkdir failed: no path"}
	}

	err := os.MkdirAll(path, 0755)
	if err != nil {
		return &WSMessage{Type: "file-error", Data: fmt.Sprintf("mkdir failed: %v", err)}
	}

	return &WSMessage{Type: "file-mkdir-result", Data: path}
}

func handleFileRmdir(path string) *WSMessage {
	if path == "" {
		return &WSMessage{Type: "file-error", Data: "rmdir failed: no path"}
	}

	err := os.RemoveAll(path)
	if err != nil {
		return &WSMessage{Type: "file-error", Data: fmt.Sprintf("rmdir failed: %v", err)}
	}

	return &WSMessage{Type: "file-rmdir-result", Data: path}
}

func handleFileRename(oldPath string, newPath string) *WSMessage {
	if oldPath == "" || newPath == "" {
		return &WSMessage{Type: "file-error", Data: "rename failed: no paths"}
	}

	err := os.Rename(oldPath, newPath)
	if err != nil {
		return &WSMessage{Type: "file-error", Data: fmt.Sprintf("rename failed: %v", err)}
	}

	return &WSMessage{Type: "file-rename-result", Data: oldPath, Path: newPath}
}