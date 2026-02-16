## MODIFIED Requirements

### Requirement: Sort workspace list
The system SHALL allow users to sort the workspace list by name, path, last modified date, SSH host, or extracted workspace path.

#### Scenario: User sorts by name
- **WHEN** a user clicks the "Name" column header
- **THEN** the workspace list is sorted alphabetically by name

#### Scenario: User sorts by last modified date
- **WHEN** a user clicks the "Last Modified" column header
- **THEN** the workspace list is sorted by date (newest first or oldest first on toggle)

#### Scenario: User sorts by SSH host
- **WHEN** a user clicks the "SSH Host" column header
- **THEN** the workspace list is sorted alphabetically by SSH host (extracted from remote workspace URIs), with empty values sorted to the end

#### Scenario: User sorts by workspace path
- **WHEN** a user clicks the "Path" column header
- **THEN** the workspace list is sorted alphabetically by the extracted workspace path
