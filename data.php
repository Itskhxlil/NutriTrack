<?php
header('Content-Type: application/json');

$file = 'data.json';

// Ensure the file exists
if (!file_exists($file)) {
    file_put_contents($file, '{}');
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Read data
    $data = file_get_contents($file);
    echo $data;
} elseif ($method === 'POST') {
    // Receive JSON data
    $input = file_get_contents('php://input');
    
    // Validate JSON
    $decoded = json_decode($input, true);
    if ($decoded !== null) {
        // Save to file
        file_put_contents($file, json_encode($decoded, JSON_PRETTY_PRINT));
        echo json_encode(['status' => 'success', 'message' => 'Data saved']);
    } else {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Invalid JSON']);
    }
} else {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
}
?>
