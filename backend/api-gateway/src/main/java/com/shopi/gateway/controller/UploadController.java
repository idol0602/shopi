package com.shopi.gateway.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/uploads")
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.OPTIONS})
public class UploadController {

    private final Path uploadDir;
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024L; // 10MB
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp", "gif");

    public UploadController(@Value("${shopi.upload.dir:/app/uploads}") String dirPath) {
        Path path = Paths.get(dirPath);
        if (!Files.exists(path)) {
            try {
                Files.createDirectories(path);
            } catch (IOException e) {
                // Fallback to local ./uploads directory
                path = Paths.get("./uploads");
                try {
                    Files.createDirectories(path);
                } catch (IOException ignored) {}
            }
        }
        this.uploadDir = path.toAbsolutePath().normalize();
        log.info("Image upload service initialized. Storage path: {}", this.uploadDir);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadFile(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is required and must not be empty");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "File size exceeds 10MB limit");
        }

        String originalFilename = file.getOriginalFilename();
        String extension = "jpg";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf(".") + 1).toLowerCase();
        }

        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only image files (jpg, jpeg, png, webp, gif) are allowed");
        }

        String storedFilename = UUID.randomUUID().toString() + "." + extension;
        Path targetPath = this.uploadDir.resolve(storedFilename);

        try {
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
            log.info("File uploaded successfully: {} (size: {} bytes)", storedFilename, file.getSize());

            String publicUrl = "/api/uploads/" + storedFilename;
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "url", publicUrl,
                    "filename", storedFilename,
                    "size", file.getSize(),
                    "contentType", file.getContentType() != null ? file.getContentType() : "image/" + extension
            ));
        } catch (IOException e) {
            log.error("Failed to store uploaded file: {}", e.getMessage(), e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to write file to disk");
        }
    }

    @GetMapping("/{filename:.+}")
    public ResponseEntity<Resource> serveFile(@PathVariable("filename") String filename) {
        try {
            Path filePath = this.uploadDir.resolve(filename).normalize();
            if (!filePath.startsWith(this.uploadDir)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid file path traversal");
            }

            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found: " + filename);
            }

            MediaType mediaType = MediaTypeFactory.getMediaType(filename).orElse(MediaType.APPLICATION_OCTET_STREAM);

            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                    .body(resource);

        } catch (Exception e) {
            if (e instanceof ResponseStatusException rse) throw rse;
            log.error("Error reading file {}: {}", filename, e.getMessage());
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found");
        }
    }
}
