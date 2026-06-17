
# Restrict cd to /workspace directory
cd() {
    local base_dir="/workspace"
    local target
    if [ -z "$1" ]; then
        target="$base_dir"
    elif [ "$1" = "-" ]; then
        target="${OLDPWD:-$base_dir}"
    else
        target="$1"
    fi
    
    local real_base
    real_base=$(python3 -c "import os, sys; print(os.path.realpath(sys.argv[1]))" "$base_dir" 2>/dev/null || echo "$base_dir")
    local abs_target
    abs_target=$(python3 -c "import os, sys; print(os.path.realpath(os.path.expanduser(sys.argv[1])))" "$target" 2>/dev/null)
    if [ -z "$abs_target" ]; then
        abs_target=$(subshell_target=$(builtin cd "$target" && pwd); echo "$subshell_target")
        abs_target=$(python3 -c "import os, sys; print(os.path.realpath(sys.argv[1]))" "$abs_target" 2>/dev/null || echo "$abs_target")
    fi

    if [[ "$abs_target" == "$real_base"* ]]; then
        builtin cd "$abs_target"
    else
        echo "yuvro-terminal: cd: access denied outside of $base_dir"
    fi
}

# Set custom premium prompt formatting mimicking iTerm/Powerline
set_prompt() {
    local rel_dir
    local dir="${PWD}"
    if [ "$dir" = "/workspace" ]; then
        rel_dir="/"
    elif [[ "$dir" == "/workspace/"* ]]; then
        rel_dir="/${dir#/workspace/}"
    else
        rel_dir="$dir"
    fi
    PS1="\[\e[44m\e[1;97m\] ${rel_dir} \[\e[0m\]\n\[\e[1;32m\]>\[\e[0m\] "
}
PROMPT_COMMAND=set_prompt

run-cpp() {
    local source_file="${1:-main.cpp}"

    if [ ! -f "$source_file" ]; then
        echo "yuvro-terminal: run-cpp: file not found: $source_file"
        return 1
    fi

    case "$source_file" in
        *.cpp|*.cc|*.cxx) ;;
        *)
            echo "yuvro-terminal: run-cpp: expected a .cpp, .cc, or .cxx file"
            return 1
            ;;
    esac

    local output_file
    output_file="$(mktemp /tmp/yuvro-cpp-XXXXXX)" || return 1

    if ! g++ -std=c++17 -O2 -Wall -Wextra "$source_file" -o "$output_file"; then
        rm -f "$output_file"
        return 1
    fi

    "$output_file"
    local exit_code=$?
    rm -f "$output_file"
    return $exit_code
}
